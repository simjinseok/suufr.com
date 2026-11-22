import { generateKeyPairSync, sign } from 'node:crypto';
import { vi } from 'vitest';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import type { PrismaClient } from '@prisma/generated/client';
import type { MailService } from '../../mail/mail.service';
import { createAuthOptions } from './auth.config';
import { BetterAuthService, type IssuedTokens } from './better-auth.service';

const EMAIL = 'teacher@example.com';
const PASSWORD = 'password-1234';

// Google 서명 키 대역. better-auth google provider 는 이 주소의 JWKS 로 ID 토큰 서명을 검증한다
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_KID = 'test-google-key';
const googleKey = generateKeyPairSync('rsa', { modulusLength: 2048 });

/** Google 이 발급하는 것과 같은 모양의 RS256 ID 토큰. 기본 audience 는 iOS 서버 클라이언트 ID(GOOGLE_ID_TOKEN_AUDIENCES) */
function googleIdToken(claims: { aud?: string } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', kid: GOOGLE_KID, typ: 'JWT' });
  const payload = encode({
    iss: 'https://accounts.google.com',
    aud: 'ios-server-client',
    sub: 'google-sub-1',
    email: EMAIL,
    email_verified: true,
    name: '선생님',
    iat: now,
    exp: now + 3600,
    ...claims,
  });
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), googleKey.privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

/**
 * 운영 설정(createAuthOptions)에서 DB 만 메모리 어댑터로 바꾼 실제 better-auth 인스턴스로 ID 토큰 로그인 배선을 검증한다.
 * 계정 연결 정책·플러그인(jwt·bearer·twoFactor)·Google provider 의 서명·issuer·audience 검증이 모두 실제 코드다 — 대역은 Google 공개키 응답뿐이다.
 */
function makeAuth() {
  // 모델명은 auth.config 를 따른다 (세션 → authSession). jwks·twoFactor 는 플러그인 테이블
  const db: Record<string, Record<string, unknown>[]> = { user: [], authSession: [], account: [], verification: [], jwks: [], twoFactor: [] };
  const options = createAuthOptions({
    prisma: {} as PrismaClient,
    baseURL: 'https://api.test',
    secret: 'test-secret-test-secret-test-secret-test',
    webUrl: 'https://web.test',
    mail: { send: vi.fn(), sendOrThrow: vi.fn() } as unknown as MailService,
    onUserCreated: vi.fn(),
    google: { clientId: 'primary-client', clientSecret: 'secret', idTokenAudiences: ['ios-server-client'] },
  });
  const auth = betterAuth({ ...options, database: memoryAdapter(db) });
  return { db, auth, service: new BetterAuthService(auth as never) };
}

beforeEach(() => {
  const jwk = { ...googleKey.publicKey.export({ format: 'jwk' }), kid: GOOGLE_KID, alg: 'RS256', use: 'sig' };
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === GOOGLE_CERTS_URL) return Response.json({ keys: [jwk] });
    throw new Error(`예상하지 못한 외부 요청: ${url}`);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BetterAuthService.signInWithGoogleIdToken', () => {
  it('유효한 ID 토큰이면 사용자를 만들고 세션 토큰과 JWT 를 발급한다', async () => {
    const { db, service } = makeAuth();

    const result = await service.signInWithGoogleIdToken(googleIdToken(), { ip: '10.0.0.1', userAgent: 'Suufr iOS' });

    expect(result.success).toBe(true);
    expect(result.accessToken.split('.')).toHaveLength(3);
    expect(db.user).toHaveLength(1);
    expect(db.account).toHaveLength(1);
    const session = db.authSession[0] as { token: string; userId: string; userAgent: string | null };
    expect(result.refreshToken).toBe(session.token);
    expect(result.userId).toBe(session.userId);
    expect(session.userAgent).toBe('Suufr iOS');
  });

  it.each(['primary-client', 'ios-server-client'])('ID 토큰 audience 는 GOOGLE_CLIENT_ID 와 GOOGLE_ID_TOKEN_AUDIENCES 를 모두 받는다 (%s)', async (aud) => {
    const { service } = makeAuth();
    await expect(service.signInWithGoogleIdToken(googleIdToken({ aud }))).resolves.toMatchObject({ success: true });
  });

  it('2단계 인증을 켠 사용자도 Google 로그인은 챌린지 없이 토큰을 받는다', async () => {
    const { db, service } = makeAuth();
    const { userId } = await service.signUp('선생님', EMAIL, PASSWORD);
    // 이메일 인증과 2FA 등록(verifyTwoFactorSetup 이 켜는 컬럼)까지 마친 비밀번호 사용자
    Object.assign(db.user[0], { emailVerified: true, twoFactorEnabled: true });
    // 대조: 같은 사용자의 비밀번호 로그인은 챌린지를 받는다 — 이 픽스처에서 2FA 가 실제로 켜져 있다
    await expect(service.signIn(EMAIL, PASSWORD)).resolves.toMatchObject({ requiresMfa: true });

    const result = await service.signInWithGoogleIdToken(googleIdToken());

    expect(result).toMatchObject({ success: true, userId });
    expect(result).not.toHaveProperty('requiresMfa');
  });

  it('같은 Google 계정으로 다시 로그인하면 새로 만들지 않고 같은 사용자로 로그인한다', async () => {
    const { db, service } = makeAuth();
    const first = await service.signInWithGoogleIdToken(googleIdToken());
    const second = await service.signInWithGoogleIdToken(googleIdToken());
    expect(second.userId).toBe(first.userId);
    expect(db.user).toHaveLength(1);
    expect(db.account).toHaveLength(1);
    expect(db.authSession).toHaveLength(2);
  });

  it('같은 이메일의 미인증 비밀번호 사용자에 Google 을 연결하면 비밀번호를 지우고 옛 세션을 폐기한다 (새 Google 세션만 유효)', async () => {
    const { db, auth, service } = makeAuth();
    // 소유권이 증명되지 않은 계정 — 남의 이메일로 먼저 가입해 둔 사람일 수 있다
    const { userId } = await service.signUp('선생님', EMAIL, PASSWORD);
    expect(db.user[0]).toMatchObject({ id: userId, emailVerified: false });
    // 미인증 로그인 차단 이전에 만들어진 세션을 흉내 낸다(지금은 미인증 계정이 비밀번호로 로그인할 수 없다)
    const before = { refreshToken: (await (await auth.$context).internalAdapter.createSession(userId)).token };

    const result = await service.signInWithGoogleIdToken(googleIdToken());

    expect(result).toMatchObject({ success: true, userId });
    expect(db.user).toHaveLength(1);
    expect(db.user[0]).toMatchObject({ id: userId, emailVerified: true });
    expect(db.account).toEqual([expect.objectContaining({ userId, providerId: 'google', accountId: 'google-sub-1' })]);
    await expect(service.refresh(before.refreshToken)).rejects.toMatchObject({ status: 401 });
    await expect(service.signIn(EMAIL, PASSWORD)).rejects.toMatchObject({ status: 401 });
    await expect(service.refresh(result.refreshToken)).resolves.toMatchObject({ success: true });
  });

  it('인증된 비밀번호 사용자에 Google 을 연결하면 비밀번호 로그인과 기존 세션을 그대로 둔다', async () => {
    const { db, service } = makeAuth();
    const { userId } = await service.signUp('선생님', EMAIL, PASSWORD);
    db.user[0].emailVerified = true;
    const before = (await service.signIn(EMAIL, PASSWORD)) as IssuedTokens;

    await service.signInWithGoogleIdToken(googleIdToken());

    await expect(service.refresh(before.refreshToken)).resolves.toMatchObject({ success: true });
    await expect(service.signIn(EMAIL, PASSWORD)).resolves.toMatchObject({ success: true, userId });
  });

  it('Google 신규 가입은 연결 정책과 무관하다 — 새 세션이 유효하고 다른 사용자의 비밀번호·세션도 그대로다', async () => {
    const { db, service } = makeAuth();
    const other = await service.signUp('다른 사람', 'other@example.com', PASSWORD);
    db.user[0].emailVerified = true; // 미인증이면 비밀번호 로그인이 막힌다
    const otherSession = (await service.signIn('other@example.com', PASSWORD)) as IssuedTokens;

    const result = await service.signInWithGoogleIdToken(googleIdToken());

    expect(result.userId).not.toBe(other.userId);
    await expect(service.refresh(result.refreshToken)).resolves.toMatchObject({ success: true });
    await expect(service.refresh(otherSession.refreshToken)).resolves.toMatchObject({ success: true });
    expect(db.account).toEqual(expect.arrayContaining([expect.objectContaining({ userId: other.userId, providerId: 'credential' })]));
  });

  it('비밀번호 계정이 없는 사용자에 Google 을 두 번째 소셜 계정으로 연결하면 미인증이어도 세션을 건드리지 않는다', async () => {
    const { db, auth, service } = makeAuth();
    const ctx = await auth.$context;
    // 다른 소셜 provider 로만 가입한 사용자(엔드포인트 밖에서 만들어 훅 context 가 없다 — 연결 시점의 판정만 본다)
    const user = await ctx.internalAdapter.createUser({ email: EMAIL, name: '선생님', emailVerified: false }, { method: 'oauth', oauth: { providerId: 'apple' } });
    await ctx.internalAdapter.createAccount({ userId: user.id, providerId: 'apple', accountId: 'apple-sub-1' });
    const existing = await ctx.internalAdapter.createSession(user.id);

    const result = await service.signInWithGoogleIdToken(googleIdToken());

    expect(result.userId).toBe(user.id);
    expect(db.account).toHaveLength(2);
    await expect(service.refresh(existing.token)).resolves.toMatchObject({ success: true });
  });

  it('같은 이메일의 인증된 비밀번호 사용자에도 Google 계정을 연결한다', async () => {
    const { db, service } = makeAuth();
    const { userId } = await service.signUp('선생님', EMAIL, PASSWORD);
    db.user[0].emailVerified = true;

    const result = await service.signInWithGoogleIdToken(googleIdToken());

    expect(result.userId).toBe(userId);
    expect(db.user).toHaveLength(1);
    expect(db.account).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId, providerId: 'google', accountId: 'google-sub-1' }),
    ]));
  });

  it('검증에 실패한 ID 토큰은 401 INVALID_TOKEN 과 Google 로그인 실패 안내로 끝난다', async () => {
    const { service } = makeAuth();
    // 서명은 맞지만 audience 가 다른 앱의 클라이언트 ID 다
    await expect(service.signInWithGoogleIdToken(googleIdToken({ aud: 'someone-elses-client' }))).rejects.toMatchObject({
      status: 401,
      response: { message: 'Google 로그인에 실패했습니다. 다시 시도해주세요.', error: 'INVALID_TOKEN' },
    });
  });
});
