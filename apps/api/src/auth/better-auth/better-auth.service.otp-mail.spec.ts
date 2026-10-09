import { ServiceUnavailableException } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import type { PrismaClient } from '@prisma/generated/client';
import { MailDeliveryError, type MailMessage, type MailService } from '../../mail/mail.service';
import { resetPasswordMail, verifyEmailMail } from '../../mail/templates/auth-mails';
import { createAuthOptions } from './auth.config';
import { BetterAuthService } from './better-auth.service';

/**
 * better-auth 는 OTP 발송 콜백이 던진 에러를 잡아 로그만 남기고 성공으로 응답한다(runInBackgroundOrAwait).
 * 가입·재발송·비밀번호찾기에서 메일 실패가 503(MAIL_DELIVERY_FAILED) 으로 호출자에게 도달해야 한다.
 * 운영 옵션(createAuthOptions)의 발송 콜백을 그대로 쓰고, DB 만 메모리 어댑터로 바꾼다.
 */
function makeAuth(send: (message: MailMessage) => Promise<void>) {
  const db: Record<string, unknown[]> = { user: [], authSession: [], account: [], verification: [], jwks: [], twoFactor: [] };
  const options = createAuthOptions({
    prisma: {} as PrismaClient,
    baseURL: 'https://api.test',
    secret: 'test-secret-test-secret-test-secret-test',
    webUrl: 'https://web.test',
    mail: { sendOrThrow: send, send: vi.fn() } as unknown as MailService,
    onUserCreated: vi.fn(),
  });
  const auth = betterAuth({ ...options, database: memoryAdapter(db) });
  return { auth, db };
}

const failing = async () => {
  throw new MailDeliveryError('SES down');
};

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
    const { auth } = makeAuth(async () => {
      if (fail) throw new MailDeliveryError('SES down');
    });
    const service = new BetterAuthService(auth as never);
    await service.signUp('선생님', 'owner@example.com', 'Passw0rd!x');
    fail = true;
    await expect503(service.resendVerification('owner@example.com'));
  });

  it('비밀번호 찾기: 메일 실패는 503, 없는 이메일은 발송 없이 성공(열거 방지 유지)', async () => {
    let fail = false;
    let calls = 0;
    const { auth } = makeAuth(async () => {
      calls++;
      if (fail) throw new MailDeliveryError('SES down');
    });
    const service = new BetterAuthService(auth as never);
    await service.signUp('선생님', 'owner@example.com', 'Passw0rd!x');
    fail = true;
    await expect503(service.requestPasswordReset('owner@example.com'));
    const before = calls;
    await expect(service.requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();
    expect(calls).toBe(before);
  });

  it('메일이 정상이면 그대로 성공한다 — 가입·재발송은 인증 코드 메일, 비밀번호 찾기는 재설정 코드 메일', async () => {
    const send = vi.fn<(message: MailMessage) => Promise<void>>().mockResolvedValue(undefined);
    const { auth } = makeAuth(send);
    const service = new BetterAuthService(auth as never);
    await expect(service.signUp('선생님', 'owner@example.com', 'Passw0rd!x')).resolves.toEqual({ userId: expect.any(String) });
    await expect(service.resendVerification('owner@example.com')).resolves.toBeUndefined();
    await expect(service.requestPasswordReset('owner@example.com')).resolves.toBeUndefined();

    const verifySubject = verifyEmailMail('owner@example.com', '000000').subject;
    const resetSubject = resetPasswordMail('owner@example.com', '000000').subject;
    expect(send.mock.calls.map(([m]) => [m.to, m.subject])).toEqual([
      ['owner@example.com', verifySubject],
      ['owner@example.com', verifySubject],
      ['owner@example.com', resetSubject],
    ]);
  });
});
