import { AuthController } from './auth.controller';

/**
 * 이전 기간 dual-run 분기만 검증한다 (서비스는 모두 mock).
 * - refresh: Cognito refresh token(점 포함 JWE) ↔ better-auth 세션 토큰(점 없음)
 * - mfa: Cognito 세션 문자열 ↔ better-auth two_factor 쿠키 쌍
 * - verify/resend/forgot: users 행 유무로 Cognito 레거시 경로 결정, AUTH_LAZY_MIGRATION=false 면 항상 better-auth
 */
function build(env: Record<string, string> = {}) {
  const cognito = {
    refreshToken: vi.fn().mockResolvedValue({ success: true, accessToken: 'cog', expiresIn: 3600 }),
    respondToMfa: vi.fn().mockResolvedValue({ success: true }),
    verifyEmail: vi.fn().mockResolvedValue({ success: true, message: 'cognito' }),
    forgotPassword: vi.fn().mockResolvedValue({ success: true, message: 'cognito' }),
  };
  const betterAuth = {
    refresh: vi.fn().mockResolvedValue({ success: true, accessToken: 'ba', expiresIn: 3600 }),
    verifySecondFactor: vi.fn().mockResolvedValue({ success: true }),
    verifyEmail: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
  const migration = { findUserByEmail: vi.fn().mockResolvedValue(null), hasCredentialAccount: vi.fn().mockResolvedValue(false) };
  const config = { get: (key: string) => env[key] };
  const controller = new AuthController(
    {} as never, cognito as never, migration as never, betterAuth as never, {} as never, {} as never, {} as never, config as never,
  );
  return { controller, cognito, betterAuth, migration };
}

describe('AuthController dual-run 분기', () => {
  it('refresh: 점이 있는 토큰은 Cognito, 없으면 better-auth', async () => {
    const { controller, cognito, betterAuth } = build();
    await controller.refresh({ refreshToken: 'eyJjdHkiOiJKV1Qi.aaaa.bbbb.cccc.dddd', username: 'sub' });
    expect(cognito.refreshToken).toHaveBeenCalledWith('eyJjdHkiOiJKV1Qi.aaaa.bbbb.cccc.dddd', 'sub');
    await controller.refresh({ refreshToken: 'Rk9vQmFy32charsrandomsessiontoken' });
    expect(betterAuth.refresh).toHaveBeenCalledWith('Rk9vQmFy32charsrandomsessiontoken');
  });

  it('refresh: Cognito 토큰인데 username 이 없으면 400', async () => {
    const { controller } = build();
    await expect(controller.refresh({ refreshToken: 'a.b.c.d.e' })).rejects.toMatchObject({ status: 400 });
  });

  it('mfa: two_factor 쿠키 쌍이면 better-auth, 아니면 Cognito', async () => {
    const { controller, cognito, betterAuth } = build();
    await controller.mfa({ email: 'a@b.c', code: '123456', session: 'better-auth.two_factor=abc.def' }, '1.1.1.1', 'ua');
    expect(betterAuth.verifySecondFactor).toHaveBeenCalledWith('better-auth.two_factor=abc.def', '123456', { ip: '1.1.1.1', userAgent: 'ua' });
    await controller.mfa({ email: 'a@b.c', code: '123456', session: 'AYABeCognitoSession' }, '1.1.1.1', 'ua');
    expect(cognito.respondToMfa).toHaveBeenCalledWith('a@b.c', '123456', 'AYABeCognitoSession');
  });

  it('verify-email/forgot-password: users 행이 없으면 Cognito 레거시, 있으면 better-auth', async () => {
    const { controller, cognito, betterAuth, migration } = build();
    await controller.verifyEmail({ email: 'legacy@b.c', code: '111111' });
    expect(cognito.verifyEmail).toHaveBeenCalled();

    migration.findUserByEmail.mockResolvedValue({ id: 'u1' });
    await controller.verifyEmail({ email: 'new@b.c', code: '111111' });
    expect(betterAuth.verifyEmail).toHaveBeenCalledWith('new@b.c', '111111');
    await controller.forgotPassword({ email: 'new@b.c' });
    expect(betterAuth.requestPasswordReset).toHaveBeenCalledWith('new@b.c');
    expect(cognito.forgotPassword).not.toHaveBeenCalled();
  });

  it('AUTH_LAZY_MIGRATION=false 면 users 행이 없어도 better-auth 경로', async () => {
    const { controller, cognito, betterAuth } = build({ AUTH_LAZY_MIGRATION: 'false' });
    await controller.verifyEmail({ email: 'x@b.c', code: '111111' });
    expect(cognito.verifyEmail).not.toHaveBeenCalled();
    expect(betterAuth.verifyEmail).toHaveBeenCalled();
  });

  it('logout: better-auth 세션 토큰만 서버에서 폐기한다', async () => {
    const { controller, betterAuth } = build();
    await controller.logout({ refreshToken: 'a.b.c.d.e' });
    expect(betterAuth.signOut).not.toHaveBeenCalled();
    await controller.logout({ refreshToken: 'sessiontoken' });
    expect(betterAuth.signOut).toHaveBeenCalledWith('sessiontoken');
  });
});
