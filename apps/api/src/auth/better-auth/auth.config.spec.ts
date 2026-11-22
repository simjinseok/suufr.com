import { describe, expect, it, vi } from 'vitest';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import type { PrismaClient } from '@prisma/generated/client';
import type { MailService } from '../../mail/mail.service';
import { existingUserSignupAttemptMail } from '../../mail/templates/auth-mails';
import { createAuthOptions, type AuthConfigDeps } from './auth.config';
import { BETTER_AUTH_BASE_PATH } from './auth.constants';
import { EMAIL_LINKED_SOCIAL_PROVIDERS } from './social-link-policy';

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
    expect([withExtra.socialProviders.google?.clientId].flat()).toEqual(['web-client', 'ios-server-client']);
    expect([withoutExtra.socialProviders.google?.clientId].flat()).toEqual(['web-client']);
  });
});

describe('createAuthOptions — Apple', () => {
  const apple = { bundleId: 'com.suufr.ios', idTokenAudiences: ['com.suufr.ios.dev', 'com.suufr.ios'] };

  it('Apple 설정이 없으면 apple provider 를 등록하지 않는다', () => {
    expect(createAuthOptions(makeDeps()).socialProviders).not.toHaveProperty('apple');
  });

  it('번들 ID 를 clientId 로, 번들 ID 와 추가 번들 ID 를 중복 없이 ID 토큰 audience 로 쓰고 clientSecret 은 비운다', () => {
    const options = createAuthOptions(makeDeps({ apple }));
    expect(options.socialProviders.apple).toEqual({
      clientId: 'com.suufr.ios',
      clientSecret: '',
      appBundleIdentifier: 'com.suufr.ios',
      audience: ['com.suufr.ios', 'com.suufr.ios.dev'],
    });
  });

  it('apple 을 trustedProviders 에 넣고 소셜 토큰 암호화를 켠다', () => {
    const options = createAuthOptions(makeDeps({ apple }));
    expect(options.account.accountLinking.trustedProviders).toEqual(['google', 'apple']);
    // 자동 연결 provider 와 미인증 연결 정책(social-link-policy) 대상이 어긋나면 선점 가입자의 비밀번호·세션이 남는다
    expect(options.account.accountLinking.trustedProviders).toEqual([...EMAIL_LINKED_SOCIAL_PROVIDERS]);
    expect(options.account.encryptOAuthTokens).toBe(true);
  });

  it('clientSecret 이 비어도 초기화되고, 브라우저 OAuth(인증 URL 생성)는 열리지 않는다', async () => {
    const db: Record<string, unknown[]> = { user: [], authSession: [], account: [], verification: [], jwks: [], twoFactor: [] };
    const auth = betterAuth({ ...createAuthOptions(makeDeps({ apple })), database: memoryAdapter(db) });

    const ctx = await auth.$context;
    expect(ctx.socialProviders.map(p => p.id)).toContain('apple');
    // ID 토큰 경로는 secret 을 쓰지 않는다(성공은 better-auth.service.apple-native.spec 이 검증). 인증 URL 생성만 secret 을 요구한다
    await expect(auth.api.signInSocial({ body: { provider: 'apple', callbackURL: '/', disableRedirect: true } }))
      .rejects.toThrow('CLIENT_ID_AND_SECRET_REQUIRED');
  });
});
