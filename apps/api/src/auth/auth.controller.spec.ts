import { AuthController } from './auth.controller';

/** 서비스는 모두 mock. 컨트롤러의 위임·응답 형태만 검증한다. */
function build() {
  const betterAuth = {
    refresh: vi.fn().mockResolvedValue({ success: true, accessToken: 'ba', expiresIn: 3600 }),
    verifySecondFactor: vi.fn().mockResolvedValue({ success: true }),
    signOut: vi.fn().mockResolvedValue(undefined),
    signUp: vi.fn().mockResolvedValue({ userId: 'u1' }),
    signInWithGoogleIdToken: vi.fn().mockResolvedValue({ success: true, accessToken: 'jwt', refreshToken: 'sess', expiresIn: 3600, userId: 'u1' }),
  };
  const authService = { findUserByEmail: vi.fn().mockResolvedValue({ id: 'u1' }) };
  const consents = { recordSafely: vi.fn().mockResolvedValue(undefined) };
  const controller = new AuthController(authService as never, betterAuth as never, consents as never, {} as never, {} as never);
  return { controller, betterAuth, authService, consents };
}

const consentsDto = { terms: true, privacy: true, termsVersion: '2026-07-08', privacyVersion: '2026-07-08' } as const;

describe('AuthController', () => {
  it('mfa: two_factor 쿠키 쌍과 코드를 그대로 위임한다', async () => {
    const { controller, betterAuth } = build();
    await controller.mfa({ code: '123456', session: 'better-auth.two_factor=abc.def' }, '1.1.1.1', 'ua');
    expect(betterAuth.verifySecondFactor).toHaveBeenCalledWith('better-auth.two_factor=abc.def', '123456', { ip: '1.1.1.1', userAgent: 'ua' });
  });

  it('google/native: ID 토큰과 요청 메타를 위임하고 토큰 응답을 그대로 돌려준다', async () => {
    const { controller, betterAuth } = build();
    const result = await controller.googleNativeLogin({ idToken: 'eyJ.id.token' }, '1.1.1.1', 'ios-ua');
    expect(betterAuth.signInWithGoogleIdToken).toHaveBeenCalledWith('eyJ.id.token', { ip: '1.1.1.1', userAgent: 'ios-ua' });
    expect(result).toEqual({ success: true, accessToken: 'jwt', refreshToken: 'sess', expiresIn: 3600, userId: 'u1' });
  });

  it('refresh / logout 은 세션 토큰을 위임한다', async () => {
    const { controller, betterAuth } = build();
    await controller.refresh({ refreshToken: 'sessiontoken' });
    expect(betterAuth.refresh).toHaveBeenCalledWith('sessiontoken');
    await expect(controller.logout({ refreshToken: 'sessiontoken' })).resolves.toEqual({ success: true });
    expect(betterAuth.signOut).toHaveBeenCalledWith('sessiontoken');
  });

  it('signup: 생성된 users.id 가 응답 id 와 같을 때만 동의 이력을 기록한다 (열거 방지 합성 응답 제외)', async () => {
    const { controller, consents, authService } = build();
    await controller.signup({ name: 'n', email: 'a@b.c', password: 'Passw0rd!x', consents: { ...consentsDto } });
    expect(consents.recordSafely).toHaveBeenCalledTimes(1);

    authService.findUserByEmail.mockResolvedValue({ id: 'existing-user' });
    await controller.signup({ name: 'n', email: 'a@b.c', password: 'Passw0rd!x', consents: { ...consentsDto } });
    expect(consents.recordSafely).toHaveBeenCalledTimes(1);
  });
});
