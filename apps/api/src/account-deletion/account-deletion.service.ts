import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { BetterAuthService } from '../auth/better-auth/better-auth.service';
import { UserExistenceService } from '../auth/guards/user-existence.service';
import { PaddleClient } from '../subscriptions/paddle.client';
import { GoogleService } from '../google/google.service';
import { S3Service } from '../s3/s3.service';
import { MailService } from '../mail/mail.service';
import { accountDeletedMail } from '../mail/templates/account-deletion-mails';
import { AccountDeletionOtpService, accountDeletionOtpIdentifier } from './account-deletion-otp.service';
import { accountDeleteError } from './account-deletion.errors';

/**
 * 탈퇴가 처리할 줄 아는 로그인 수단(accounts.provider_id)과 각 수단의 외부 정리.
 * 목록 밖 제공자의 연결 계정이 있으면 삭제를 거부한다(ACCOUNT_DELETE_UNSUPPORTED_PROVIDER) — 새 로그인 수단을 넣을 때
 * 외부 토큰 폐기를 빠뜨린 채 계정이 지워지지 않게 하는 장치다 (account-deletion.service.spec.ts 가 목록을 고정한다).
 *
 * Apple 로그인을 넣을 때: 여기에 'apple' 을 추가하고 AppleTokenService.revoke 를 연결한다. 저장된 refresh token 이 없으면
 * 요청 body 의 appleAuthorizationCode(iOS 가 Apple 재로그인으로 받은 값)를 교환해 폐기한다. accounts 행은 users 삭제 때
 * Cascade 로 사라지므로 이 정리는 반드시 DB 트랜잭션 앞(revokeLoginProviders)에서 실행된다.
 * - credential: 외부 상태 없음
 * - google: 로그인용 accounts 행의 토큰은 앱이 쓰지 않으므로 행 삭제로 충분하다 (캘린더 연동 토큰은 cleanupGoogle 이 폐기)
 */
type LoginProviderCleanup = (context: { userId: string; accountId: string; input: DeleteAccountInput }) => Promise<void>;
export const SUPPORTED_LOGIN_PROVIDERS = ['credential', 'google'] as const;
export type SupportedLoginProvider = typeof SUPPORTED_LOGIN_PROVIDERS[number];
const LOGIN_PROVIDER_CLEANUPS: Record<SupportedLoginProvider, LoginProviderCleanup | null> = {
  credential: null,
  google: null,
};

/** 이 시간이 지나도록 users 가 남아 있는 선점 행은 끝나지 못한 시도(프로세스 중단 등)로 보고 넘겨받는다 */
export const STALE_CLAIM_MS = 15 * 60_000;
/** 되돌릴 수 없는 단계(구독 해지 등) 뒤의 트랜잭션 시도 횟수 — 동시 쓰기로 인한 FK 위반·직렬화 실패 같은 일시적 실패를 한 번 더 시도한다 */
const DELETE_TRANSACTION_ATTEMPTS = 2;

export type DeleteAccountInput = { password?: string; otp?: string };

type UserAccount = { providerId: string; accountId: string; password: string | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 사용자 단위 S3 prefix. 계정의 파일·프로필 이미지는 전부 이 아래에 있다 (예외: legacy 키, collectLegacyKeys) */
export function storagePrefixes(userId: string): string[] {
  if (!UUID_PATTERN.test(userId)) throw new Error(`invalid user id for storage prefix: ${userId}`);
  return [`users/${userId}/`, `images/profiles/${userId}/`];
}

/**
 * 계정 삭제 (회원 탈퇴). 계획: docs/superpowers/plans/2026-11-22-account-deletion.md
 * better-auth deleteUser 는 쓰지 않는다 — 도메인 삭제가 users 삭제와 한 트랜잭션이 아니고, 재인증 규칙(비밀번호/freshAge)이 맞지 않는다.
 *
 * 순서: 재인증 → 탈퇴 기록 선점 → Paddle 즉시 해지 → Google 연동 정리 → 로그인 수단 외부 정리 → S3 키 수집
 *       → 트랜잭션(도메인 행 + users, legacy 키 저장) → S3 일괄 삭제·CloudFront 무효화 → 가드 캐시 무효화 → 완료 메일.
 * 트랜잭션 커밋 전에 실패하면 이 요청의 선점 행만 지우고 오류를 낸다(아무것도 지우지 않음).
 * 단 users 가 이미 없으면(커밋은 됐는데 응답이 끊긴 경우, 넘겨받은 다른 요청이 끝낸 경우) 탈퇴는 끝난 것이라 선점을 남긴다.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);
  private readonly emailHmacKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly betterAuth: BetterAuthService,
    private readonly otp: AccountDeletionOtpService,
    private readonly userExistence: UserExistenceService,
    private readonly paddle: PaddleClient,
    private readonly google: GoogleService,
    private readonly s3: S3Service,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('BETTER_AUTH_SECRET');
    if (!secret) throw new Error('BETTER_AUTH_SECRET 환경변수가 필요합니다');
    // BETTER_AUTH_SECRET 을 바꾸면 기존 탈퇴 기록과 대조할 수 없게 된다 (바꿀 때 이 파생 키를 따로 고정할 것)
    this.emailHmacKey = createHmac('sha256', secret).update('suufr:account-deletion:email').digest();
  }

  /** 탈퇴 기록의 이메일 HMAC. 분쟁 시 당사자가 댄 이메일을 같은 방식으로 계산해 대조한다 */
  emailHmac(email: string): string {
    return createHmac('sha256', this.emailHmacKey).update(email.trim().toLowerCase()).digest('hex');
  }

  /** 비밀번호가 없는 계정의 재인증 코드 발송 */
  async sendOtp(userId: string): Promise<void> {
    const { user, accounts } = await this.loadUser(userId);
    this.assertSupportedProviders(accounts);
    if (this.hasPassword(accounts)) {
      throw accountDeleteError('ACCOUNT_DELETE_REAUTH_REQUIRED', '비밀번호로 확인하는 계정입니다. 비밀번호를 입력해주세요.');
    }
    await this.otp.send(userId, user.email);
  }

  async deleteAccount(userId: string, input: DeleteAccountInput): Promise<void> {
    const { user, accounts } = await this.loadUser(userId);

    // 1. 로그인 수단 가드 + 재인증 (아무것도 바꾸기 전에)
    this.assertSupportedProviders(accounts);
    await this.reauthenticate(userId, accounts, input);

    // 2. 탈퇴 기록 선점 — 동시 요청 방지. 이 행이 있는 동안 웹훅은 구독 행을 만들지 않는다
    const claimedAt = await this.claim(userId, user.email);

    let canceledSubscription = false;
    try {
      // 3. Paddle 즉시 해지. 실패하면 중단 (지운 계정에 계속 청구되지 않게)
      canceledSubscription = await this.cancelSubscription(userId);
      // 4. Google 캘린더 연동 정리 (best-effort)
      await this.cleanupGoogle(userId);
      // 5. 로그인 수단 외부 정리 — accounts 가 Cascade 로 지워지기 전이어야 한다
      await this.revokeLoginProviders(userId, accounts, input);
      // 6. 커밋 뒤 지울 S3 키 수집 (행이 지워지면 알 수 없다). 트랜잭션이 탈퇴 기록에 저장해 크론 재시도도 같은 키를 지운다
      const legacyKeys = await this.collectLegacyKeys(userId);
      // 7. 도메인 행 + users 를 한 트랜잭션으로
      await this.runDeleteTransaction(userId, user.email, legacyKeys, canceledSubscription);
    }
    catch (error) {
      if (await this.isUserGone(userId)) {
        // 커밋은 됐는데 응답만 실패했거나, 이 요청이 멈춘 사이 선점을 넘겨받은 요청이 삭제를 끝냈다.
        // 탈퇴 기록(이메일 HMAC·보존 기간 기준·스토리지 재시도 대상)을 지우면 안 된다. 스토리지는 크론이 마저 지운다
        this.logger.warn(`Account ${userId} is already deleted; keeping deletion record despite error: ${error instanceof Error ? error.message : String(error)}`);
        this.userExistence.invalidate(userId);
        return;
      }
      // 이 요청이 잡은 선점만 푼다 — 오래된 선점을 넘겨받은 다른 요청의 행은 deleted_at 이 달라 남는다
      await this.prisma.accountDeletion.deleteMany({ where: { userId, deletedAt: claimedAt } }).catch((releaseError) => {
        this.logger.error(`탈퇴 선점 해제 실패 (user ${userId})`, releaseError instanceof Error ? releaseError.stack : String(releaseError));
      });
      throw error;
    }

    // 8~9. 커밋 이후는 실패해도 탈퇴 자체는 끝났다
    this.userExistence.invalidate(userId);
    this.logger.log(`Deleted account ${userId}`);
    await this.purgeStorage(userId);
    void this.mail.send(accountDeletedMail(user.email, canceledSubscription));
  }

  /**
   * 도메인 행 + users 삭제 트랜잭션. 앞선 단계(구독 해지·Google 정리·OTP 소진)는 되돌릴 수 없으므로 일시적 실패는 한 번 더 시도한다.
   * deleteUserRows 는 deleteMany 위주라 다시 실행해도 안전하다. 최종 실패는 구독 해지 여부와 함께 Sentry 에 남긴다
   */
  private async runDeleteTransaction(userId: string, email: string, legacyKeys: string[], canceledSubscription: boolean): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.prisma.$transaction(tx => this.deleteUserRows(tx, userId, email, legacyKeys), {
          maxWait: 5000,
          timeout: 60_000,
        });
        return;
      }
      catch (error) {
        // 앞선 시도가 실제로는 커밋됐으면(users 없음) 다시 시도하지 않는다 — 호출부 catch 가 완료로 처리한다
        if (attempt >= DELETE_TRANSACTION_ATTEMPTS || await this.isUserGone(userId)) {
          this.logger.error(`탈퇴 트랜잭션 실패 (user ${userId}, 시도 ${attempt}회, 구독 해지 ${canceledSubscription ? '됨' : '없음'})`, error instanceof Error ? error.stack : String(error));
          Sentry.captureException(error, {
            tags: { feature: 'account-deletion', stage: 'transaction' },
            extra: { userId, attempts: attempt, canceledSubscription },
          });
          throw error;
        }
        this.logger.warn(`탈퇴 트랜잭션 재시도 (user ${userId}): ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /** users 행이 확실히 없을 때만 true. 조회가 실패하면 모른다고 보고 false */
  private async isUserGone(userId: string): Promise<boolean> {
    try {
      return await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }) === null;
    }
    catch {
      return false;
    }
  }

  /**
   * S3 일괄 삭제(사용자 prefix 두 개 + 탈퇴 기록에 저장된 legacy 키) + CloudFront 무효화.
   * 성공하면 storage_purged_at 을 기록하고 저장된 키를 비운다.
   * 실패는 Sentry 로 남기고, 크론(AccountDeletionCleanupService)이 같은 범위(prefix + 저장된 키)를 다시 시도한다.
   */
  async purgeStorage(userId: string): Promise<boolean> {
    try {
      const record = await this.prisma.accountDeletion.findUnique({ where: { userId }, select: { pendingStorageKeys: true } });
      const legacyKeys = record?.pendingStorageKeys ?? [];
      let deleted = 0;
      for (const prefix of storagePrefixes(userId)) {
        deleted += await this.s3.deleteByPrefix(prefix);
      }
      for (const key of legacyKeys) {
        if (!await this.s3.deleteFile(key)) throw new Error(`S3 delete failed: ${key}`);
        deleted += 1;
      }
      // 캐시된 사본이 남지 않게 (공개 프로필 이미지 + 서명 URL 로 공유된 파일). 실패해도 캐시는 만료되므로 재시도 대상은 아니다
      const invalidated = await this.s3.invalidateCloudFrontPaths([
        `/images/profiles/${userId}/*`,
        `/users/${userId}/*`,
        ...legacyKeys.map(key => `/${key}`),
      ]);
      if (!invalidated) this.logger.warn(`CloudFront 무효화 실패 (user ${userId})`);

      await this.prisma.accountDeletion.update({ where: { userId }, data: { storagePurgedAt: new Date(), pendingStorageKeys: [] } });
      this.logger.log(`Purged ${deleted} storage object(s) of deleted account ${userId}`);
      return true;
    }
    catch (error) {
      this.logger.error(`탈퇴 계정 스토리지 삭제 실패 (user ${userId})`, error instanceof Error ? error.stack : String(error));
      Sentry.captureException(error, { tags: { feature: 'account-deletion' }, extra: { userId } });
      return false;
    }
  }

  private async loadUser(userId: string): Promise<{ user: { id: string; email: string }; accounts: UserAccount[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, accounts: { select: { providerId: true, accountId: true, password: true } } },
    });
    // 가드가 사용자 존재를 확인하므로 정상 경로에서는 나오지 않는다 (확인 직후 다른 요청이 지운 경우)
    if (!user) throw accountDeleteError('ACCOUNT_DELETE_IN_PROGRESS');
    return { user: { id: user.id, email: user.email }, accounts: user.accounts };
  }

  private hasPassword(accounts: UserAccount[]): boolean {
    return accounts.some(account => account.providerId === 'credential' && Boolean(account.password));
  }

  private assertSupportedProviders(accounts: UserAccount[]): void {
    const unsupported = accounts.filter(account => !(SUPPORTED_LOGIN_PROVIDERS as readonly string[]).includes(account.providerId));
    if (unsupported.length > 0) {
      this.logger.warn(`Account deletion refused: unsupported login provider(s) ${unsupported.map(a => a.providerId).join(',')}`);
      throw accountDeleteError('ACCOUNT_DELETE_UNSUPPORTED_PROVIDER');
    }
  }

  /** 비밀번호가 있으면 비밀번호(2FA 사용자도 비밀번호만), 없으면 이메일 코드 */
  private async reauthenticate(userId: string, accounts: UserAccount[], input: DeleteAccountInput): Promise<void> {
    if (this.hasPassword(accounts)) {
      if (!input.password) {
        throw accountDeleteError('ACCOUNT_DELETE_REAUTH_REQUIRED', '비밀번호를 입력해주세요');
      }
      if (!await this.betterAuth.verifyPassword(userId, input.password)) {
        throw accountDeleteError('ACCOUNT_DELETE_INVALID_PASSWORD');
      }
      return;
    }
    if (!input.otp) {
      throw accountDeleteError('ACCOUNT_DELETE_REAUTH_REQUIRED', '이메일로 받은 인증코드를 입력해주세요');
    }
    await this.otp.verify(userId, input.otp);
  }

  /**
   * account_deletions 에 행 선점. 이미 있으면 409 — 단 오래된 미완료 선점(users 가 남아 있음)은 넘겨받는다.
   * @returns 이 요청이 기록한 선점 시각. 실패 시 이 값이 그대로일 때만 선점을 푼다 (컬럼이 초 단위라 초로 맞춰 기록한다)
   */
  private async claim(userId: string, email: string): Promise<Date> {
    const emailHmac = this.emailHmac(email);
    const claimedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    try {
      await this.prisma.accountDeletion.create({ data: { userId, emailHmac, deletedAt: claimedAt } });
      return claimedAt;
    }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
    // 이 함수는 users 가 있을 때만 불린다(loadUser). 따라서 남은 선점 행은 진행 중이거나 중단된 시도다
    const { count } = await this.prisma.accountDeletion.updateMany({
      where: { userId, deletedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } },
      data: { deletedAt: claimedAt, emailHmac, storagePurgedAt: null, pendingStorageKeys: [] },
    });
    if (count === 0) throw accountDeleteError('ACCOUNT_DELETE_IN_PROGRESS');
    this.logger.warn(`Took over stale account deletion claim of user ${userId}`);
    return claimedAt;
  }

  /**
   * 구독 정리. Paddle 은 즉시 해지(남은 기간 환불 없음 — 확인 화면 고지)하고, 실패하면 탈퇴 전체를 중단한다.
   * 해지에 성공하면 로컬 행도 바로 종료 상태로 바꾼다 — 뒤 단계가 실패해 계정이 남아도 웹훅 없이 상태가 맞는다
   * (선점 중 오는 웹훅은 건너뛰기 때문). manual·apple·google 행은 트랜잭션에서 지우기만 한다
   * (App Store·Play 구독이 생기면 서버에서 해지할 수 없으므로 클라이언트 안내가 필요하다 — 아직 없음).
   * @returns 유료 구독을 해지했으면 true (완료 메일 문구)
   */
  private async cancelSubscription(userId: string): Promise<boolean> {
    const subscription = await this.prisma.userSubscription.findUnique({ where: { userId } });
    // expired = Paddle 쪽이 이미 canceled(종결). paused 도 expired 로 매핑되지만 스프는 일시정지를 쓰지 않는다
    if (!subscription || subscription.provider !== 'paddle' || !subscription.providerSubscriptionId || subscription.status === 'expired') {
      return false;
    }
    const subscriptionId = subscription.providerSubscriptionId;
    try {
      await this.paddle.cancelImmediately(subscriptionId);
    }
    catch (error) {
      // 이미 종료된 구독이면 해지 요청이 거부된다 — 원격 상태가 canceled 면 목적은 달성된 것
      const alreadyCanceled = await this.paddle.getSubscription(subscriptionId)
        .then(remote => remote.status === 'canceled')
        .catch(() => false);
      if (!alreadyCanceled) {
        this.logger.error(`Paddle 즉시 해지 실패 (user ${userId}, ${subscriptionId})`, error instanceof Error ? error.stack : String(error));
        Sentry.captureException(error, { tags: { feature: 'account-deletion', provider: 'paddle' }, extra: { userId, subscriptionId } });
        throw accountDeleteError('ACCOUNT_DELETE_SUBSCRIPTION_CANCEL_FAILED');
      }
      return false;
    }
    const now = new Date();
    await this.prisma.userSubscription.updateMany({
      where: { userId, provider: 'paddle', providerSubscriptionId: subscriptionId },
      data: { status: 'expired', canceledAt: subscription.canceledAt ?? now, currentPeriodEnd: now, providerLastEventAt: now },
    });
    return true;
  }

  /** 스프 전용 캘린더 삭제·watch 중지(disconnect) + OAuth 토큰 폐기. 실패해도 탈퇴는 계속한다 */
  private async cleanupGoogle(userId: string): Promise<void> {
    const connected = await this.prisma.externalServiceToken.findFirst({ where: { userId, provider: 'google' }, select: { id: true } });
    if (!connected) return;
    try {
      await this.google.disconnect(userId);
    }
    catch (error) {
      this.logger.error(`Google 연동 해제 실패 (user ${userId})`, error instanceof Error ? error.stack : String(error));
    }
    try {
      await this.google.revokeToken(userId);
    }
    catch (error) {
      this.logger.error(`Google 토큰 폐기 실패 (user ${userId})`, error instanceof Error ? error.stack : String(error));
    }
  }

  /** 로그인 수단별 외부 토큰 폐기 (LOGIN_PROVIDER_CLEANUPS). 던지면 탈퇴를 중단한다 */
  private async revokeLoginProviders(userId: string, accounts: UserAccount[], input: DeleteAccountInput): Promise<void> {
    for (const account of accounts) {
      const cleanup = LOGIN_PROVIDER_CLEANUPS[account.providerId as SupportedLoginProvider];
      if (cleanup) await cleanup({ userId, accountId: account.accountId, input });
    }
  }

  /**
   * 사용자 prefix 밖에 있는 이 계정의 S3 키 — CardDAV 사진 업로드(`{folder}/{uuid}`, DAV 제거 전까지는 새로 생긴다), 구 공개 경로 등.
   * 우리 버킷·CDN 을 가리키지 않는 URL 과 다른 사용자의 prefix 는 제외한다.
   */
  private async collectLegacyKeys(userId: string): Promise<string[]> {
    const studentScope = { OR: [{ userId }, { organization: { userId } }] };
    const [mediaFiles, organizations, students] = await Promise.all([
      this.prisma.mediaFile.findMany({ where: { userId }, select: { publicId: true } }),
      this.prisma.organization.findMany({ where: { userId }, select: { logoImageKey: true, logoImageUrl: true, profileImageUrl: true } }),
      this.prisma.student.findMany({ where: { ...studentScope, profileImageUrl: { not: null } }, select: { profileImageUrl: true } }),
    ]);
    const candidates = [
      ...mediaFiles.map(file => file.publicId),
      ...organizations.flatMap(org => [org.logoImageKey, org.logoImageUrl, org.profileImageUrl]),
      ...students.map(student => student.profileImageUrl),
    ];
    const keys = new Set<string>();
    for (const candidate of candidates) {
      const key = this.toOwnedKey(candidate);
      if (!key) continue;
      // 사용자 prefix 는 일괄 삭제가 맡고, 다른 사용자의 prefix 는 절대 건드리지 않는다
      if (key.startsWith('users/') || key.startsWith('images/profiles/')) continue;
      keys.add(key);
    }
    return [...keys];
  }

  /** URL 또는 키 → 우리 버킷의 객체 키. 외부 URL 이면 null */
  private toOwnedKey(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!trimmed.includes('://')) return trimmed.replace(/^\/+/, '') || null;

    let url: URL;
    try {
      url = new URL(trimmed);
    }
    catch {
      return null;
    }
    const ownOrigins = [process.env.CDN_URL, process.env.CLOUDFRONT_URL]
      .filter((origin): origin is string => Boolean(origin))
      .map((origin) => {
        try {
          return new URL(origin).host;
        }
        catch {
          return null;
        }
      });
    const bucket = process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION;
    if (bucket && region) ownOrigins.push(`${bucket}.s3.${region}.amazonaws.com`);
    if (!ownOrigins.includes(url.host)) return null;
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    return key || null;
  }

  /**
   * 사용자의 모든 행 삭제 (소프트 삭제된 행 포함). 분류는 account-deletion.tables.ts — 모델을 추가하면 여기에도 넣는다.
   * 도메인 관계에 onDelete 가 없으므로 자식 → 부모 순서로 지운다. 범위는 관계 필터로 잡아 큰 id 목록을 파라미터로 넘기지 않는다.
   */
  async deleteUserRows(tx: Prisma.TransactionClient, userId: string, email: string, legacyKeys: string[] = []): Promise<void> {
    // 학생은 userId 와 과외방 두 경로로 사용자에 속한다
    const studentScope: Prisma.StudentWhereInput = { OR: [{ userId }, { organization: { userId } }] };
    const curriculumScope: Prisma.CurriculumWhereInput = { organization: { userId } };

    // 연결 테이블 (양끝 중 하나라도 이 사용자 것이면)
    await tx.sessionMediaFile.deleteMany({ where: { OR: [{ session: { student: studentScope } }, { mediaFile: { userId } }] } });
    await tx.curriculumItemMediaFile.deleteMany({ where: { OR: [{ curriculumItem: { curriculum: curriculumScope } }, { mediaFile: { userId } }] } });
    await tx.invoicePayment.deleteMany({ where: { OR: [{ invoice: { student: studentScope } }, { payment: { student: studentScope } }] } });

    // 수업
    await tx.sessionGoogleEvent.deleteMany({ where: { OR: [{ userId }, { session: { student: studentScope } }] } });
    await tx.feedback.deleteMany({ where: { session: { student: studentScope } } });
    await tx.session.deleteMany({ where: { student: studentScope } });

    // 입금·수강권 (invoices.lesson_id 는 lessons 를 가리키므로 lessons 보다 먼저)
    await tx.payment.deleteMany({ where: { student: studentScope } });
    await tx.invoice.deleteMany({ where: { student: studentScope } });
    await tx.lessonShare.deleteMany({ where: { lesson: { student: studentScope } } });
    await tx.lesson.deleteMany({ where: { student: studentScope } });

    // 학생
    await tx.studentShare.deleteMany({ where: { student: studentScope } });
    await tx.studentComment.deleteMany({ where: { student: studentScope } });
    await tx.studentStatus.deleteMany({ where: { student: studentScope } });
    await tx.studentGoogleContact.deleteMany({ where: { OR: [{ userId }, { student: studentScope }] } });
    await tx.student.deleteMany({ where: studentScope });

    // 과외방 (상담·커리큘럼 포함)
    await tx.meeting.deleteMany({ where: { OR: [{ userId }, { organization: { userId } }] } });
    await tx.curriculumItem.deleteMany({ where: { curriculum: curriculumScope } });
    await tx.curriculumSection.deleteMany({ where: { curriculum: curriculumScope } });
    await tx.curriculum.deleteMany({ where: curriculumScope });
    await tx.organization.deleteMany({ where: { userId } });

    // 파일 (folders.parent_id·media_files.folder_id 는 SET NULL 이라 순서 무관)
    await tx.mediaFile.deleteMany({ where: { userId } });
    await tx.folder.deleteMany({ where: { userId } });

    // 사용자 단위 행
    await tx.userSettings.deleteMany({ where: { userId } });
    await tx.userStorageQuota.deleteMany({ where: { userId } });
    await tx.externalServiceToken.deleteMany({ where: { userId } });
    await tx.googleSyncToken.deleteMany({ where: { userId } });
    await tx.userSubscription.deleteMany({ where: { userId } });

    // better-auth 검증 값: 이메일 OTP(유형별 식별자), 탈퇴 OTP, 값이 userId 인 비밀번호 재설정 토큰
    const normalizedEmail = email.trim().toLowerCase();
    await tx.verification.deleteMany({
      where: {
        OR: [
          { identifier: { in: [...EMAIL_OTP_TYPES.map(type => `${type}-otp-${normalizedEmail}`), accountDeletionOtpIdentifier(userId)] } },
          { value: userId },
        ],
      },
    });

    // users → auth_sessions·accounts·two_factors 는 Cascade
    await tx.user.delete({ where: { id: userId } });

    // 선점 시각 → 실제 삭제 시각 (보존 기간 계산 기준). legacy 키는 행이 사라진 뒤 다시 알 수 없으므로 같은 트랜잭션에 남긴다
    await tx.accountDeletion.update({ where: { userId }, data: { deletedAt: new Date(), pendingStorageKeys: legacyKeys } });
  }
}

/** better-auth emailOTP 식별자 `${type}-otp-${email}` 의 type 목록 (better-auth 1.7.26 plugins/email-otp) */
const EMAIL_OTP_TYPES = ['email-verification', 'sign-in', 'forget-password', 'change-email'] as const;
