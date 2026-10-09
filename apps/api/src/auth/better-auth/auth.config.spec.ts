import { describe, expect, it, vi } from 'vitest';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import type { PrismaClient } from '@prisma/generated/client';
import type { MailService } from '../../mail/mail.service';
import { existingUserSignupAttemptMail } from '../../mail/templates/auth-mails';
import { createAuthOptions, type AuthConfigDeps } from './auth.config';
import { BETTER_AUTH_BASE_PATH } from './auth.constants';

function makeDeps(overrides: Partial<AuthConfigDeps> = {}): AuthConfigDeps {
  return {
    prisma: {} as PrismaClient,
    baseURL: 'http://localhost:4000',
    secret: 'test-secret-test-secret-test-secret-test',
    webUrl: 'http://localhost:3000',
    mail: { send: vi.fn(), sendOrThrow: vi.fn() } as unknown as MailService,
    onUserCreated: vi.fn(),
    ...overrides,
  };
}

/** 운영 옵션 그대로, DB 만 메모리 어댑터로 바꾼 better-auth 인스턴스 */
function makeAuth() {
  const mail = { send: vi.fn(), sendOrThrow: vi.fn() };
  const db: Record<string, unknown[]> = { user: [], authSession: [], account: [], verification: [], jwks: [], twoFactor: [] };
  const auth = betterAuth({ ...createAuthOptions(makeDeps({ mail: mail as unknown as MailService })), database: memoryAdapter(db) });
  return { auth, db, mail };
}

const signUpBody = { name: '선생님', email: 'owner@example.com', password: 'Passw0rd!x' };

describe('createAuthOptions', () => {
  const options = createAuthOptions(makeDeps());

  it('비밀번호 재설정 시 기존 세션을 모두 폐기한다 (미인증 가입 세션이 계정 회수 후 살아남지 않도록)', () => {
    expect(options.emailAndPassword.revokeSessionsOnPasswordReset).toBe(true);
  });

  it('이메일 인증 전이라도 가입한 비밀번호로 바로 로그인된다 (가입 즉시 로그인)', async () => {
    const { auth } = makeAuth();
    await auth.api.signUpEmail({ body: signUpBody });

    const signedIn = await auth.api.signInEmail({ body: { email: signUpBody.email, password: signUpBody.password } });

    expect(signedIn.token).toEqual(expect.any(String));
    expect(signedIn.user.emailVerified).toBe(false);
  });

  it('이미 가입된 이메일로 다시 가입하면 에러 없이 합성 사용자(다른 id)를 돌려주고 기존 사용자에게 알림 메일을 보낸다', async () => {
    const { auth, db, mail } = makeAuth();
    const first = await auth.api.signUpEmail({ body: signUpBody });

    const again = await auth.api.signUpEmail({ body: { ...signUpBody, name: '다른 사람', password: 'Another-Passw0rd' } });

    expect(again.token).toBeNull();
    expect(again.user.id).not.toBe(first.user.id);
    expect(db.user).toHaveLength(1);
    expect(mail.send).toHaveBeenCalledWith(existingUserSignupAttemptMail(signUpBody.email));
  });

  it('OTP 단독 로그인(비밀번호 우회) 경로 /sign-in/email-otp 는 better-auth HTTP 핸들러에서 404 다', async () => {
    const { auth } = makeAuth();
    const post = (path: string, body: object) => auth.handler(new Request(`http://localhost:4000${BETTER_AUTH_BASE_PATH}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'origin': 'http://localhost:3000' },
      body: JSON.stringify(body),
    }));
    // 대조: 켜져 있는 경로는 404 가 아니다 — 경로 계산이 틀려 모든 요청이 404 로 통과하는 것을 막는다
    expect((await post('/sign-in/email', { email: signUpBody.email, password: 'wrong-password' })).status).not.toBe(404);
    expect((await post('/sign-in/email-otp', { email: signUpBody.email, otp: '123456' })).status).toBe(404);
  });

  it('Google: 추가 ID 토큰 audience 가 있으면 clientId 는 [기본 클라이언트, ...추가] 순서이고, 없으면 기본 클라이언트 하나다', () => {
    const google = { clientId: 'web-client', clientSecret: 'google-secret' };
    const withExtra = createAuthOptions(makeDeps({ google: { ...google, idTokenAudiences: ['ios-server-client'] } }));
    const withoutExtra = createAuthOptions(makeDeps({ google: { ...google, idTokenAudiences: [] } }));

    // 배열이면 첫 번째가 OAuth(인증 URL·코드 교환)에 쓰이므로 순서도 계약이다
    expect([withExtra.socialProviders?.google.clientId].flat()).toEqual(['web-client', 'ios-server-client']);
    expect([withoutExtra.socialProviders?.google.clientId].flat()).toEqual(['web-client']);
  });
});
