import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { bearer, jwt } from 'better-auth/plugins';
import { BetterAuthService } from './better-auth.service';

/**
 * 실제 better-auth 인스턴스(메모리 어댑터)로 ID 토큰 로그인 배선을 검증한다.
 * Google 서명 검증만 provider 옵션(verifyIdToken·getUserInfo)으로 대체한다 — 나머지(사용자 생성·연결·세션·JWT)는 실제 코드다.
 */
function makeAuth(opts: { verify: boolean; email?: string; emailVerified?: boolean }) {
  const db: Record<string, unknown[]> = { user: [], session: [], account: [], verification: [], jwks: [] };
  const auth = betterAuth({
    baseURL: 'https://api.test',
    secret: 'test-secret-test-secret-test-secret-test',
    database: memoryAdapter(db),
    // 실제 auth.config 와 같은 구성: jwt(JWT 발급) + bearer(세션 토큰을 Authorization 헤더로 받음)
    plugins: [jwt(), bearer()],
    socialProviders: {
      google: {
        clientId: ['primary-client', 'ios-server-client'],
        clientSecret: 'secret',
        verifyIdToken: async () => opts.verify,
        // 실제 구현은 ID 토큰 클레임을 디코드해 data 로 넘긴다. 계정 키는 data.sub 에서 나오므로 같은 모양으로 준다
        getUserInfo: (async () => {
          const email = opts.email ?? 'teacher@example.com';
          const claims = { sub: 'google-sub-1', email, email_verified: opts.emailVerified ?? true, name: '선생님' };
          return { user: { id: claims.sub, email, name: claims.name, emailVerified: claims.email_verified }, data: claims };
        }) as never,
      },
    },
  });
  return { auth, db };
}

describe('BetterAuthService.signInWithGoogleIdToken', () => {
  it('유효한 ID 토큰이면 사용자를 만들고 세션 토큰과 JWT 를 발급한다 (2FA 챌린지 없음)', async () => {
    const { auth, db } = makeAuth({ verify: true });
    const service = new BetterAuthService(auth as never);

    const result = await service.signInWithGoogleIdToken('id.token', { ip: '10.0.0.1', userAgent: 'Suufr iOS' });

    expect(result.success).toBe(true);
    expect(result.accessToken.split('.')).toHaveLength(3);
    expect(db.user).toHaveLength(1);
    expect(db.account).toHaveLength(1);
    const session = db.session[0] as { token: string; userId: string; userAgent: string | null };
    expect(result.refreshToken).toBe(session.token);
    expect(result.userId).toBe(session.userId);
    expect(session.userAgent).toBe('Suufr iOS');
    expect(result).not.toHaveProperty('requiresMfa');
  });

  it('같은 이메일 사용자가 있으면 새로 만들지 않고 그 사용자로 로그인한다', async () => {
    const { auth, db } = makeAuth({ verify: true, email: 'existing@example.com' });
    const service = new BetterAuthService(auth as never);
    await service.signInWithGoogleIdToken('id.token.1');
    await service.signInWithGoogleIdToken('id.token.2');
    expect(db.user).toHaveLength(1);
    expect(db.session).toHaveLength(2);
  });

  it('검증에 실패한 ID 토큰은 401 로 끝난다', async () => {
    const { auth } = makeAuth({ verify: false });
    const service = new BetterAuthService(auth as never);
    await expect(service.signInWithGoogleIdToken('bad.token')).rejects.toMatchObject({ status: 401 });
  });
});
