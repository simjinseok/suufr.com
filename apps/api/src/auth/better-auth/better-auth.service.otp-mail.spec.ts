import { ServiceUnavailableException } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { emailOTP } from 'better-auth/plugins';
import { MailDeliveryError } from '../../mail/mail.service';
import { BetterAuthService } from './better-auth.service';
import { recordOtpMailFailure } from './otp-mail-failure';

/**
 * better-auth 는 OTP 발송 콜백이 던진 에러를 잡아 로그만 남기고 성공으로 응답한다(runInBackgroundOrAwait).
 * 가입·재발송·비밀번호찾기에서 메일 실패가 503(MAIL_DELIVERY_FAILED) 으로 호출자에게 도달해야 한다.
 */
function makeAuth(send: (email: string) => Promise<void>) {
  const db: Record<string, unknown[]> = { user: [], session: [], account: [], verification: [] };
  const auth = betterAuth({
    baseURL: 'https://api.test',
    secret: 'test-secret-test-secret-test-secret-test',
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true, requireEmailVerification: false, autoSignIn: false },
    emailVerification: { sendOnSignUp: true },
    plugins: [
      emailOTP({
        overrideDefaultEmailVerification: true,
        // 실제 auth.config 의 콜백과 같은 모양: 실패를 기록하고 다시 던진다
        async sendVerificationOTP({ email }) {
          try {
            await send(email);
          }
          catch (error) {
            recordOtpMailFailure(error);
            throw error;
          }
        },
      }),
    ],
  });
  return { auth, db };
}

const failing = async () => { throw new MailDeliveryError('SES down'); };

function expect503(p: Promise<unknown>) {
  return expect(p).rejects.toSatisfy((e: unknown) =>
    e instanceof ServiceUnavailableException && (e.getResponse() as { error: string }).error === 'MAIL_DELIVERY_FAILED');
}

describe('BetterAuthService — OTP 메일 발송 실패 전파', () => {
  it('가입: 메일 실패는 503 으로 돌아오고 계정은 만들어져 있다', async () => {
    const { auth, db } = makeAuth(failing);
    const service = new BetterAuthService(auth as never);
    await expect503(service.signUp('선생님', 'owner@example.com', 'Passw0rd!x'));
    expect(db.user).toHaveLength(1);
  });

  it('인증코드 재발송: 메일 실패는 503', async () => {
    let fail = false;
    const { auth } = makeAuth(async () => { if (fail) throw new MailDeliveryError('SES down'); });
    const service = new BetterAuthService(auth as never);
    await service.signUp('선생님', 'owner@example.com', 'Passw0rd!x');
    fail = true;
    await expect503(service.resendVerification('owner@example.com'));
  });

  it('비밀번호 찾기: 메일 실패는 503, 없는 이메일은 발송 없이 성공(열거 방지 유지)', async () => {
    let fail = false;
    let calls = 0;
    const { auth } = makeAuth(async () => { calls++; if (fail) throw new MailDeliveryError('SES down'); });
    const service = new BetterAuthService(auth as never);
    await service.signUp('선생님', 'owner@example.com', 'Passw0rd!x');
    fail = true;
    await expect503(service.requestPasswordReset('owner@example.com'));
    const before = calls;
    await expect(service.requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();
    expect(calls).toBe(before);
  });

  it('메일이 정상이면 그대로 성공한다', async () => {
    const { auth } = makeAuth(async () => undefined);
    const service = new BetterAuthService(auth as never);
    await expect(service.signUp('선생님', 'owner@example.com', 'Passw0rd!x')).resolves.toEqual({ userId: expect.any(String) });
    await expect(service.resendVerification('owner@example.com')).resolves.toBeUndefined();
    await expect(service.requestPasswordReset('owner@example.com')).resolves.toBeUndefined();
  });
});
