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
  return { db, service: new BetterAuthService(auth as never) };
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

  it('같은 이메일의 미인증 비밀번호 사용자에 Google 계정을 연결하고 이메일을 인증 처리한다', async () => {
    const { db, service } = makeAuth();
    // 가입 즉시 로그인(#53)이라 이메일 인증 전인 계정이 흔하다
    const { userId } = await service.signUp('선생님', EMAIL, PASSWORD);
    expect(db.user[0]).toMatchObject({ id: userId, emailVerified: false });

    const result = await service.signInWithGoogleIdToken(googleIdToken());

    expect(result).toMatchObject({ success: true, userId });
    expect(result.accessToken.split('.')).toHaveLength(3);
    expect(db.user).toHaveLength(1);
    expect(db.user[0]).toMatchObject({ id: userId, emailVerified: true });
    expect(db.account).toHaveLength(2);
    expect(db.account).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId, providerId: 'credential' }),
      expect.objectContaining({ userId, providerId: 'google', accountId: 'google-sub-1' }),
    ]));
  });

  it('Google 계정을 연결해도 기존 비밀번호 로그인과 세션은 그대로 유지된다', async () => {
    const { service } = makeAuth();
    const { userId } = await service.signUp('선생님', EMAIL, PASSWORD);
    // 가입 직후 로그인으로 받은 세션
    const before = (await service.signIn(EMAIL, PASSWORD)) as IssuedTokens;

    await service.signInWithGoogleIdToken(googleIdToken());

    await expect(service.refresh(before.refreshToken)).resolves.toMatchObject({ success: true });
    await expect(service.signIn(EMAIL, PASSWORD)).resolves.toMatchObject({ success: true, userId });
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
