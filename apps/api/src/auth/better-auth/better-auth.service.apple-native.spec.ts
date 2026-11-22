import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { vi } from 'vitest';
import * as Sentry from '@sentry/nestjs';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { decryptOAuthToken } from 'better-auth/oauth2';
import type { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '@prisma/generated/client';
import type { MailService } from '../../mail/mail.service';
import { APPLE_TOKEN_URL, AppleTokenRequestError, AppleTokenService } from '../apple-token.service';
import { createAuthOptions } from './auth.config';
import { BetterAuthService, type AppleIdTokenSignIn, type IssuedTokens } from './better-auth.service';

vi.mock('@sentry/nestjs', () => ({ captureException: vi.fn() }));

const EMAIL = 'teacher@example.com';
const PASSWORD = 'password-1234';
const RELAY_EMAIL = 'x7k2p9q4mz@privaterelay.appleid.com';
const APPLE_SUB = '001234.abcdef0123456789abcdef.0123';
const RAW_NONCE = 'raw-nonce-from-ios';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_KID = 'test-apple-key';
const APPLE_FAILED = { status: 401, response: { message: 'Apple 로그인에 실패했습니다. 다시 시도해주세요.', error: 'INVALID_TOKEN' } };

// Apple identity token 서명 키(JWKS 대역)와 client secret 서명용 .p8 대역
const appleSigningKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
const appleClientKey = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const APPLE_KEY_ENV: Record<string, string> = {
  APPLE_TEAM_ID: 'TEAM123456',
  APPLE_KEY_ID: 'KEY1234567',
  APPLE_PRIVATE_KEY: (appleClientKey.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string).replace(/\n/g, '\\n'),
};

/** iOS 는 원문 nonce 의 SHA-256(소문자 hex)을 요청에 넣고, Apple 은 그 값을 nonce 클레임에 싣는다. 서버는 원문을 받는다 */
const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

/** Apple 이 발급하는 것과 같은 모양의 RS256 identity token. 값이 undefined 인 클레임은 빠진다 */
function appleIdToken(claims: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', kid: APPLE_KID });
  const payload = encode({
    iss: 'https://appleid.apple.com',
    aud: 'com.suufr.ios',
    sub: APPLE_SUB,
    email: EMAIL,
    email_verified: 'true',
    is_private_email: 'false',
    nonce: sha256Hex(RAW_NONCE),
    nonce_supported: true,
    auth_time: now,
    iat: now,
    exp: now + 600,
    ...claims,
  });
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), appleSigningKey.privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

/**
 * 운영 설정(createAuthOptions)에서 DB 만 메모리 어댑터로 바꾼 실제 better-auth 인스턴스.
 * Apple provider 의 서명·issuer·audience·nonce·만료 검증, 계정 연결 정책, 토큰 암호화가 모두 실제 코드다 — 대역은 Apple JWKS·토큰 엔드포인트 응답뿐이다.
 */
function makeAuth(opts: { apple?: boolean; appleKeys?: boolean } = {}) {
  const db: Record<string, Record<string, unknown>[]> = { user: [], authSession: [], account: [], verification: [], jwks: [], twoFactor: [] };
  const onUserCreated = vi.fn();
  const options = createAuthOptions({
    prisma: {} as PrismaClient,
    baseURL: 'https://api.test',
    secret: 'test-secret-test-secret-test-secret-test',
    webUrl: 'https://web.test',
    mail: { send: vi.fn(), sendOrThrow: vi.fn() } as unknown as MailService,
    onUserCreated,
    apple: opts.apple === false ? undefined : { bundleId: 'com.suufr.ios', idTokenAudiences: ['com.suufr.ios.dev'] },
  });
  const auth = betterAuth({ ...options, database: memoryAdapter(db) });
  const env: Record<string, string> = opts.appleKeys === false ? {} : APPLE_KEY_ENV;
  const appleTokens = new AppleTokenService({ get: (key: string) => env[key] } as unknown as ConfigService);
  return { db, auth, onUserCreated, service: new BetterAuthService(auth as never, appleTokens) };
}

function login(service: BetterAuthService, input: Partial<AppleIdTokenSignIn> = {}, meta?: { ip?: string; userAgent?: string }) {
  return service.signInWithAppleIdToken({ idToken: appleIdToken(), nonce: RAW_NONCE, ...input }, meta);
}

const appleAccount = (db: Record<string, Record<string, unknown>[]>) =>
  db.account.find(a => a.providerId === 'apple') as { id: string; userId: string; accountId: string; refreshToken?: string | null };

let tokenEndpoint: () => Response | Promise<Response>;
let tokenRequests: URLSearchParams[];

beforeEach(() => {
  tokenRequests = [];
  tokenEndpoint = () => Response.json({ access_token: 'apple-access', refresh_token: 'apple-refresh-1', id_token: 'unused', token_type: 'Bearer', expires_in: 3600 });
  const jwk = { ...appleSigningKey.publicKey.export({ format: 'jwk' }), kid: APPLE_KID, alg: 'RS256', use: 'sig' };
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === APPLE_KEYS_URL) return Response.json({ keys: [jwk] });
    if (url === APPLE_TOKEN_URL) {
      tokenRequests.push(new URLSearchParams(String(init?.body)));
      return tokenEndpoint();
    }
    throw new Error(`예상하지 못한 외부 요청: ${url}`);
  }));
  vi.mocked(Sentry.captureException).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BetterAuthService.signInWithAppleIdToken — 가입·로그인', () => {
  it('유효한 identity token 이면 이메일 인증된 사용자와 apple 계정을 만들고 세션 토큰과 JWT 를 발급한다', async () => {
    const { db, service } = makeAuth();

    const result = await login(service, {}, { ip: '10.0.0.1', userAgent: 'Suufr iOS' });

    expect(result.success).toBe(true);
    expect(result.accessToken.split('.')).toHaveLength(3);
    expect(db.user).toHaveLength(1);
    expect(db.user[0]).toMatchObject({ email: EMAIL, emailVerified: true });
    expect(db.account).toEqual([expect.objectContaining({ providerId: 'apple', accountId: APPLE_SUB, userId: result.userId })]);
    const session = db.authSession[0] as { token: string; userAgent: string | null };
    expect(result.refreshToken).toBe(session.token);
    expect(session.userAgent).toBe('Suufr iOS');
  });

  it('최초 로그인에 받은 이름을 그대로 사용자 이름으로 쓰고 가입 훅에 넘긴다', async () => {
    const { db, service, onUserCreated } = makeAuth();
    await login(service, { name: '홍길동' });
    expect(db.user[0].name).toBe('홍길동');
    expect(onUserCreated).toHaveBeenCalledWith(expect.objectContaining({ email: EMAIL, name: '홍길동' }));
  });

  it('이름이 없으면 빈 이름으로 만든다', async () => {
    const { db, service } = makeAuth();
    await login(service);
    expect(db.user[0].name).toBe('');
  });

  it('나의 이메일 가리기(릴레이) 주소도 정상 가입되고, 같은 사람의 기존 이메일 계정과 겹치지 않는다', async () => {
    const { db, service, onUserCreated } = makeAuth();
    const { userId: existing } = await service.signUp('선생님', EMAIL, PASSWORD);

    const result = await login(service, { idToken: appleIdToken({ email: RELAY_EMAIL, is_private_email: 'true' }) });

    expect(result.userId).not.toBe(existing);
    expect(db.user).toHaveLength(2);
    expect(onUserCreated).toHaveBeenLastCalledWith(expect.objectContaining({ email: RELAY_EMAIL, name: '' }));
  });

  it('같은 Apple 계정으로 다시 로그인하면 같은 사용자이고, 다시 보낸 이름으로 덮어쓰지 않는다', async () => {
    const { db, service } = makeAuth();
    const first = await login(service, { name: '홍길동' });
    const second = await login(service, { name: '다른이름' });
    expect(second.userId).toBe(first.userId);
    expect(db.user).toHaveLength(1);
    expect(db.account).toHaveLength(1);
    expect(db.authSession).toHaveLength(2);
    expect(db.user[0].name).toBe('홍길동');
  });

  it.each(['com.suufr.ios', 'com.suufr.ios.dev'])('audience 는 APPLE_APP_BUNDLE_ID 와 APPLE_ID_TOKEN_AUDIENCES 를 모두 받는다 (%s)', async (aud) => {
    const { service } = makeAuth();
    await expect(login(service, { idToken: appleIdToken({ aud }) })).resolves.toMatchObject({ success: true });
  });

  it('2단계 인증을 켠 사용자도 Apple 로그인은 챌린지 없이 토큰을 받는다', async () => {
    const { db, service } = makeAuth();
    const { userId } = await service.signUp('선생님', EMAIL, PASSWORD);
    Object.assign(db.user[0], { emailVerified: true, twoFactorEnabled: true });
    // 대조: 같은 사용자의 비밀번호 로그인은 챌린지를 받는다
    await expect(service.signIn(EMAIL, PASSWORD)).resolves.toMatchObject({ requiresMfa: true });

    const result = await login(service);

    expect(result).toMatchObject({ success: true, userId });
    expect(result).not.toHaveProperty('requiresMfa');
  });
});

describe('BetterAuthService.signInWithAppleIdToken — 거부', () => {
  it('nonce 가 토큰과 다르면 401 이고 사용자를 만들지 않는다', async () => {
    const { db, service } = makeAuth();
    await expect(login(service, { nonce: 'someone-elses-nonce' })).rejects.toMatchObject(APPLE_FAILED);
    expect(db.user).toHaveLength(0);
  });

  it('nonce 가 비어 있으면 better-auth 를 부르지 않고 401 (better-auth 는 빈 nonce 면 검사를 건너뛴다)', async () => {
    const { db, service } = makeAuth();
    await expect(login(service, { nonce: '' })).rejects.toMatchObject(APPLE_FAILED);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(db.user).toHaveLength(0);
  });

  it('토큰의 nonce 클레임 값을 그대로 nonce 로 보내면 401 (better-auth 는 원문 일치도 허용하므로 서비스가 막는다)', async () => {
    const { db, service } = makeAuth();
    await expect(login(service, { nonce: sha256Hex(RAW_NONCE) })).rejects.toMatchObject(APPLE_FAILED);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(db.user).toHaveLength(0);
  });

  it('토큰에 nonce 클레임이 없으면 401', async () => {
    const { service } = makeAuth();
    await expect(login(service, { idToken: appleIdToken({ nonce: undefined }) })).rejects.toMatchObject(APPLE_FAILED);
  });

  it('JWT 가 아닌 값은 401', async () => {
    const { service } = makeAuth();
    await expect(login(service, { idToken: 'not-a-jwt' })).rejects.toMatchObject(APPLE_FAILED);
  });

  it('다른 앱(audience)의 토큰은 401', async () => {
    const { service } = makeAuth();
    await expect(login(service, { idToken: appleIdToken({ aud: 'com.someone.else' }) })).rejects.toMatchObject(APPLE_FAILED);
  });

  it('만료된 토큰은 401', async () => {
    const { service } = makeAuth();
    const now = Math.floor(Date.now() / 1000);
    await expect(login(service, { idToken: appleIdToken({ iat: now - 1200, exp: now - 600 }) })).rejects.toMatchObject(APPLE_FAILED);
  });

  it('Apple 설정(APPLE_APP_BUNDLE_ID)이 없으면 400 PROVIDER_NOT_FOUND 와 Apple 로그인 실패 안내', async () => {
    const { service } = makeAuth({ apple: false });
    await expect(login(service)).rejects.toMatchObject({
      status: 400,
      response: { message: 'Apple 로그인에 실패했습니다. 다시 시도해주세요.', error: 'PROVIDER_NOT_FOUND' },
    });
  });
});

describe('BetterAuthService.signInWithAppleIdToken — 계정 연결', () => {
  it('같은 이메일의 미인증 비밀번호 사용자에 Apple 을 연결하면 비밀번호를 지우고 옛 세션을 폐기한다 (새 Apple 세션만 유효)', async () => {
    const { db, auth, service } = makeAuth();
    const { userId } = await service.signUp('선생님', EMAIL, PASSWORD);
    expect(db.user[0]).toMatchObject({ id: userId, emailVerified: false });
    // 미인증 로그인 차단 이전에 만들어진 세션을 흉내 낸다(지금은 미인증 계정이 비밀번호로 로그인할 수 없다)
    const before = { refreshToken: (await (await auth.$context).internalAdapter.createSession(userId)).token };

    const result = await login(service);

    expect(result.userId).toBe(userId);
    expect(db.user[0]).toMatchObject({ id: userId, emailVerified: true });
    expect(db.account).toEqual([expect.objectContaining({ userId, providerId: 'apple', accountId: APPLE_SUB })]);
    await expect(service.refresh(before.refreshToken)).rejects.toMatchObject({ status: 401 });
    await expect(service.signIn(EMAIL, PASSWORD)).rejects.toMatchObject({ status: 401 });
    await expect(service.refresh(result.refreshToken)).resolves.toMatchObject({ success: true });
  });

  it.each(['deleteUserSessions', 'deleteAccount'] as const)('연결 정리 중 %s 가 실패하면 연결하지 않고, 재로그인 때 다시 정리한다 (비밀번호·옛 세션이 남지 않는다)', async (step) => {
    const { db, auth, service } = makeAuth();
    const { userId } = await service.signUp('선생님', EMAIL, PASSWORD);
    // 미인증 로그인 차단 이전에 만들어진 세션을 흉내 낸다(지금은 미인증 계정이 비밀번호로 로그인할 수 없다)
    const before = { refreshToken: (await (await auth.$context).internalAdapter.createSession(userId)).token };
    const ctx = await auth.$context;
    vi.spyOn(ctx.internalAdapter, step).mockRejectedValueOnce(new Error('일시적 DB 장애'));

    await expect(login(service)).rejects.toMatchObject({ status: 401 });
    // 정리가 끝나지 않았으면 apple 계정 행도 없어야 다음 시도가 다시 '연결' 경로(훅 실행)로 간다
    expect(db.account.filter(a => a.providerId === 'apple')).toEqual([]);
    expect(db.user[0]).toMatchObject({ id: userId, emailVerified: false });

    const result = await login(service);

    expect(result.userId).toBe(userId);
    expect(db.account).toEqual([expect.objectContaining({ userId, providerId: 'apple', accountId: APPLE_SUB })]);
    await expect(service.refresh(before.refreshToken)).rejects.toMatchObject({ status: 401 });
    await expect(service.signIn(EMAIL, PASSWORD)).rejects.toMatchObject({ status: 401 });
    await expect(service.refresh(result.refreshToken)).resolves.toMatchObject({ success: true });
  });

  it('같은 이메일의 인증된 비밀번호 사용자에 연결하고 비밀번호 로그인·기존 세션을 유지한다', async () => {
    const { db, service } = makeAuth();
    const { userId } = await service.signUp('선생님', EMAIL, PASSWORD);
    db.user[0].emailVerified = true;
    const before = (await service.signIn(EMAIL, PASSWORD)) as IssuedTokens;

    const result = await login(service);

    expect(result.userId).toBe(userId);
    expect(db.user).toHaveLength(1);
    expect(db.account).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId, providerId: 'credential' }),
      expect.objectContaining({ userId, providerId: 'apple', accountId: APPLE_SUB }),
    ]));
    await expect(service.refresh(before.refreshToken)).resolves.toMatchObject({ success: true });
    await expect(service.signIn(EMAIL, PASSWORD)).resolves.toMatchObject({ success: true, userId });
  });

  it('Apple 신규 가입은 연결 정책과 무관하다 — 새 세션이 유효하고 다른 사용자의 비밀번호·세션도 그대로다', async () => {
    const { db, service } = makeAuth();
    const other = await service.signUp('다른 사람', 'other@example.com', PASSWORD);
    db.user[0].emailVerified = true; // 미인증이면 비밀번호 로그인이 막힌다
    const otherSession = (await service.signIn('other@example.com', PASSWORD)) as IssuedTokens;

    const result = await login(service);

    expect(result.userId).not.toBe(other.userId);
    await expect(service.refresh(result.refreshToken)).resolves.toMatchObject({ success: true });
    await expect(service.refresh(otherSession.refreshToken)).resolves.toMatchObject({ success: true });
    expect(db.account).toEqual(expect.arrayContaining([expect.objectContaining({ userId: other.userId, providerId: 'credential' })]));
  });

  it('Google 로 가입한(비밀번호 없는) 사용자에 Apple 을 연결하면 같은 users.id 에 계정 둘이 되고 세션을 건드리지 않는다', async () => {
    const { db, auth, service } = makeAuth();
    const ctx = await auth.$context;
    // 미인증이어도 비밀번호 계정이 없으면 폐기 대상이 아니다 (엔드포인트 밖에서 만들어 훅 context 가 없다 — 연결 시점의 판정만 본다)
    const googleUser = await ctx.internalAdapter.createUser({ email: EMAIL, name: '선생님', emailVerified: false }, { method: 'oauth', oauth: { providerId: 'google' } });
    await ctx.internalAdapter.createAccount({ userId: googleUser.id, providerId: 'google', accountId: 'google-sub-1' });
    const existing = await ctx.internalAdapter.createSession(googleUser.id);

    const result = await login(service);

    expect(result.userId).toBe(googleUser.id);
    expect(db.user).toHaveLength(1);
    expect(db.account).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: googleUser.id, providerId: 'google' }),
      expect.objectContaining({ userId: googleUser.id, providerId: 'apple', accountId: APPLE_SUB }),
    ]));
    await expect(service.refresh(existing.token)).resolves.toMatchObject({ success: true });
  });
});

describe('BetterAuthService.signInWithAppleIdToken — revoke 용 refresh token', () => {
  it('authorization code 를 토큰의 번들 ID(aud)로 교환해 refresh token 을 apple 계정 행에 암호화해 저장한다', async () => {
    const { db, auth, service } = makeAuth();

    await login(service, { idToken: appleIdToken({ aud: 'com.suufr.ios.dev' }), authorizationCode: 'code-1' });

    expect(tokenRequests).toHaveLength(1);
    expect(Object.fromEntries(tokenRequests[0])).toMatchObject({ grant_type: 'authorization_code', code: 'code-1', client_id: 'com.suufr.ios.dev' });
    const stored = appleAccount(db).refreshToken;
    expect(stored).toEqual(expect.any(String));
    expect(stored).not.toBe('apple-refresh-1');
    await expect(decryptOAuthToken(stored ?? '', (await auth.$context) as never)).resolves.toBe('apple-refresh-1');
  });

  it('aud 가 여러 값이면 허용 목록에 있는 번들 ID 를 client_id 로 쓴다', async () => {
    const { service } = makeAuth();
    await login(service, { idToken: appleIdToken({ aud: ['com.someone.else', 'com.suufr.ios.dev'] }), authorizationCode: 'code-1' });
    expect(tokenRequests[0].get('client_id')).toBe('com.suufr.ios.dev');
  });

  it('code 없이 다시 로그인해도 저장된 refresh token 은 지워지지 않는다', async () => {
    const { db, auth, service } = makeAuth();
    await login(service, { authorizationCode: 'code-1' });
    await login(service);
    await expect(decryptOAuthToken(appleAccount(db).refreshToken ?? '', (await auth.$context) as never)).resolves.toBe('apple-refresh-1');
  });

  // 사용자가 기기 설정에서 'Apple로 로그인 사용 중단' 후 재승인하면 저장된 토큰은 무효가 된다. 탈퇴 때 폐기할 수 있게 새 code 로 덮어쓴다
  it('refresh token 이 저장돼 있어도 code 가 오면 다시 교환해 새 토큰으로 덮어쓴다', async () => {
    const { db, auth, service } = makeAuth();
    await login(service, { authorizationCode: 'code-1' });

    tokenEndpoint = () => Response.json({ refresh_token: 'apple-refresh-2' });
    await login(service, { authorizationCode: 'code-2' });

    expect(tokenRequests.map(form => form.get('code'))).toEqual(['code-1', 'code-2']);
    await expect(decryptOAuthToken(appleAccount(db).refreshToken ?? '', (await auth.$context) as never)).resolves.toBe('apple-refresh-2');
  });

  it('재교환이 실패하면 저장된 refresh token 을 그대로 둔다', async () => {
    const { db, auth, service } = makeAuth();
    await login(service, { authorizationCode: 'code-1' });

    tokenEndpoint = () => Response.json({ error: 'invalid_grant' }, { status: 400 });
    await expect(login(service, { authorizationCode: 'code-2' })).resolves.toMatchObject({ success: true });

    expect(tokenRequests).toHaveLength(2);
    await expect(decryptOAuthToken(appleAccount(db).refreshToken ?? '', (await auth.$context) as never)).resolves.toBe('apple-refresh-1');
  });

  it('응답에 refresh token 이 없으면 저장된 값을 그대로 둔다', async () => {
    const { db, auth, service } = makeAuth();
    await login(service, { authorizationCode: 'code-1' });

    tokenEndpoint = () => Response.json({ access_token: 'apple-access' });
    await login(service, { authorizationCode: 'code-2' });

    expect(tokenRequests).toHaveLength(2);
    await expect(decryptOAuthToken(appleAccount(db).refreshToken ?? '', (await auth.$context) as never)).resolves.toBe('apple-refresh-1');
  });

  it('Apple 이 교환을 거부해도 로그인은 성공하고, Sentry 에 code 없이 기록한다', async () => {
    tokenEndpoint = () => Response.json({ error: 'invalid_grant' }, { status: 400 });
    const { db, service } = makeAuth();

    const result = await login(service, { authorizationCode: 'code-1' });

    expect(result).toMatchObject({ success: true });
    expect(appleAccount(db).refreshToken ?? null).toBeNull();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(AppleTokenRequestError),
      expect.objectContaining({ extra: expect.objectContaining({ stage: 'apple-code-exchange', userId: result.userId }) }),
    );
    const [error, hint] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error & { cause?: unknown }, unknown];
    expect(JSON.stringify({ message: error.message, cause: error.cause, error, hint })).not.toContain('code-1');
  });

  it('교환이 실패한 뒤 다음 로그인(code 포함)에서 저장된다', async () => {
    tokenEndpoint = () => Response.json({ error: 'invalid_grant' }, { status: 400 });
    const { db, auth, service } = makeAuth();
    await login(service, { authorizationCode: 'code-1' });

    tokenEndpoint = () => Response.json({ refresh_token: 'apple-refresh-2' });
    await login(service, { authorizationCode: 'code-2' });

    expect(tokenRequests.map(form => form.get('code'))).toEqual(['code-1', 'code-2']);
    await expect(decryptOAuthToken(appleAccount(db).refreshToken ?? '', (await auth.$context) as never)).resolves.toBe('apple-refresh-2');
  });

  it('Apple 토큰 엔드포인트가 네트워크 오류여도 로그인은 성공한다', async () => {
    tokenEndpoint = () => {
      throw new TypeError('fetch failed');
    };
    const { service } = makeAuth();
    await expect(login(service, { authorizationCode: 'code-1' })).resolves.toMatchObject({ success: true });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('authorization code 가 없거나 Apple 키 설정이 없으면 교환하지 않는다', async () => {
    await login(makeAuth().service);
    const { service } = makeAuth({ appleKeys: false });
    await expect(login(service, { authorizationCode: 'code-1' })).resolves.toMatchObject({ success: true });
    expect(tokenRequests).toHaveLength(0);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
