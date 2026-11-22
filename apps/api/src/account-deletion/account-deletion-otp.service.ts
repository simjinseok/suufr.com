import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ACCOUNT_DELETION_OTP_MINUTES, deleteAccountOtpMail } from '../mail/templates/account-deletion-mails';
import { toHttpException } from '../auth/better-auth/better-auth-error.map';
import { accountDeleteError } from './account-deletion.errors';

export const ACCOUNT_DELETION_OTP_TTL_MS = ACCOUNT_DELETION_OTP_MINUTES * 60_000;
export const ACCOUNT_DELETION_OTP_MAX_ATTEMPTS = 5;
export const ACCOUNT_DELETION_OTP_COOLDOWN_MS = 60_000;
/** verify 의 시도 횟수 compare-and-swap 재시도 한도 */
const VERIFY_CAS_ROUNDS = 10;

export function accountDeletionOtpIdentifier(userId: string): string {
  return `delete-account-otp:${userId}`;
}

/**
 * 계정 삭제 재인증용 이메일 코드 (비밀번호가 없는 계정). better-auth emailOTP 의 type 에 삭제용이 없어 직접 둔다.
 * verifications 에 `delete-account-otp:{userId}` 식별자로 한 행만 둔다. value = `{HMAC(코드)}:{실패 횟수}`.
 * 10분 만료, 5회 실패하면 만료까지 잠김(TOO_MANY_ATTEMPTS), 재요청은 60초에 한 번.
 */
@Injectable()
export class AccountDeletionOtpService {
  private readonly hashKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('BETTER_AUTH_SECRET');
    if (!secret) throw new Error('BETTER_AUTH_SECRET 환경변수가 필요합니다');
    // 용도별로 키를 분리한다 (같은 비밀에서 파생)
    this.hashKey = createHmac('sha256', secret).update('suufr:account-deletion:otp').digest();
  }

  private hash(otp: string): string {
    return createHmac('sha256', this.hashKey).update(otp).digest('hex');
  }

  /** 새 코드를 만들어 메일로 보낸다. 쿨다운 중이면 429, 메일 실패면 503 (그 경우 코드는 남기지 않는다) */
  async send(userId: string, email: string): Promise<void> {
    const identifier = accountDeletionOtpIdentifier(userId);
    const now = Date.now();
    const previous = await this.prisma.verification.findFirst({
      where: { identifier },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (previous && now - previous.createdAt.getTime() < ACCOUNT_DELETION_OTP_COOLDOWN_MS) {
      // 429 의 문구는 HttpExceptionFilter 가 공통 문구로 바꾼다
      throw new HttpException({ message: '인증코드는 1분에 한 번만 받을 수 있습니다', error: 'ACCOUNT_DELETE_OTP_COOLDOWN' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const id = randomUUID();
    await this.prisma.$transaction([
      this.prisma.verification.deleteMany({ where: { identifier } }),
      this.prisma.verification.create({
        data: { id, identifier, value: `${this.hash(otp)}:0`, expiresAt: new Date(now + ACCOUNT_DELETION_OTP_TTL_MS) },
      }),
    ]);

    try {
      await this.mail.sendOrThrow(deleteAccountOtpMail(email, otp));
    }
    catch (error) {
      // 받지 못한 코드로 쿨다운이 걸리지 않게 지운다
      await this.prisma.verification.deleteMany({ where: { id } }).catch(() => undefined);
      throw toHttpException(error);
    }
  }

  /**
   * 코드 확인. 맞으면 행을 지운다(재사용 불가). 만료면 행을 지운 뒤 오류.
   * 시도 횟수는 비교 전에 원자적으로 올린다(compare-and-swap) — 동시에 여러 코드를 보내도 한 번의 비교마다 한 번씩 센다.
   * 횟수를 다 쓴 행은 지우지 않고 남긴다 — 만료까지 TOO_MANY_ATTEMPTS 가 유지되고, 재발송 쿨다운(createdAt 기준)도 풀리지 않는다.
   */
  async verify(userId: string, otp: string): Promise<void> {
    const identifier = accountDeletionOtpIdentifier(userId);
    for (let round = 0; round < VERIFY_CAS_ROUNDS; round++) {
      const row = await this.prisma.verification.findFirst({
        where: { identifier },
        orderBy: { createdAt: 'desc' },
      });
      if (!row) {
        throw accountDeleteError('ACCOUNT_DELETE_INVALID_OTP');
      }
      if (row.expiresAt.getTime() <= Date.now()) {
        await this.prisma.verification.deleteMany({ where: { id: row.id } });
        throw accountDeleteError('ACCOUNT_DELETE_OTP_EXPIRED');
      }

      const separator = row.value.lastIndexOf(':');
      const storedHash = row.value.slice(0, separator);
      const attempts = Number.parseInt(row.value.slice(separator + 1), 10) || 0;
      // better-auth emailOTP 와 같은 규칙: 5번 틀릴 때까지는 INVALID, 그다음 시도부터 TOO_MANY_ATTEMPTS
      if (attempts >= ACCOUNT_DELETION_OTP_MAX_ATTEMPTS) {
        throw accountDeleteError('ACCOUNT_DELETE_OTP_TOO_MANY_ATTEMPTS');
      }

      // 이번 시도를 먼저 센다. 그 사이 다른 시도가 값을 바꿨으면(count 0) 다시 읽는다
      const { count: counted } = await this.prisma.verification.updateMany({
        where: { id: row.id, value: row.value },
        data: { value: `${storedHash}:${attempts + 1}` },
      });
      if (counted === 0) {
        continue;
      }

      const expected = Buffer.from(storedHash, 'hex');
      const actual = Buffer.from(this.hash(otp), 'hex');
      if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
        // 같은 코드로 동시에 두 번 들어와도 행 삭제는 한 번만 성공한다
        const { count } = await this.prisma.verification.deleteMany({ where: { id: row.id } });
        if (count === 1) return;
      }
      throw accountDeleteError('ACCOUNT_DELETE_INVALID_OTP');
    }
    // 경합이 계속돼 횟수를 세지 못했다 — 비교하지 않고 실패로 돌려준다
    throw accountDeleteError('ACCOUNT_DELETE_INVALID_OTP');
  }
}
