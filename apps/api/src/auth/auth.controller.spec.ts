import { ForbiddenException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '../common/constants/legal';

/** 서비스는 모두 mock. 컨트롤러의 위임·응답 형태만 검증한다. */
function build() {
  const betterAuth = {
    refresh: vi.fn().mockResolvedValue({ success: true, accessToken: 'ba', expiresIn: 3600 }),
    verifySecondFactor: vi.fn().mockResolvedValue({ success: true }),
    signOut: vi.fn().mockResolvedValue(undefined),
    verifyEmail: vi.fn().mockResolvedValue(undefined),
    signUp: vi.fn().mockResolvedValue({ userId: 'u1' }),
    signIn: vi.fn().mockResolvedValue({ success: true, accessToken: 'jwt', refreshToken: 'sess', expiresIn: 3600, userId: 'u1' }),
    signInWithGoogleIdToken: vi.fn().mockResolvedValue({ success: true, accessToken: 'jwt', refreshToken: 'sess', expiresIn: 3600, userId: 'u1' }),
  };
  const authService = { findUserByEmail: vi.fn().mockResolvedValue({ id: 'u1' }) };
  const consents = { recordSafely: vi.fn().mockResolvedValue(undefined), recordIfAbsent: vi.fn().mockResolvedValue(true) };
  const recaptcha = { verifySignup: vi.fn().mockResolvedValue(undefined) };
  const controller = new AuthController(authService as never, betterAuth as never, consents as never, {} as never, {} as never, recaptcha as never);
  return { controller, betterAuth, authService, consents, recaptcha };
}

const consentsDto = { terms: true, privacy: true, termsVersion: '2026-07-08', privacyVersion: '2026-07-08' } as const;

describe('AuthController', () => {
  it('mfa: two_factor 쿠키 쌍과 코드를 그대로 위임한다', async () => {
    const { controller, betterAuth } = build();
    await controller.mfa({ code: '123456', session: 'better-auth.two_factor=abc.def' }, '1.1.1.1', 'ua');
    expect(betterAuth.verifySecondFactor).toHaveBeenCalledWith('better-auth.two_factor=abc.def', '123456', { ip: '1.1.1.1', userAgent: 'ua' });
  });

  it('google/native: ID 토큰과 요청 메타를 위임하고, 이력이 없는 사용자에게 현재 문서 버전으로 동의를 기록한 뒤 토큰을 돌려준다', async () => {
    const { controller, betterAuth, consents } = build();
    const result = await controller.googleNativeLogin({ idToken: 'eyJ.id.token' }, '1.1.1.1', 'ios-ua');
    expect(betterAuth.signInWithGoogleIdToken).toHaveBeenCalledWith('eyJ.id.token', { ip: '1.1.1.1', userAgent: 'ios-ua' });
    expect(consents.recordIfAbsent).toHaveBeenCalledWith(
      'u1',
      { terms: true, privacy: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_POLICY_VERSION },
      { ipAddress: '1.1.1.1', userAgent: 'ios-ua' },
    );
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

  it('signup: 실제로 생성됐으면 바로 로그인해 토큰을 돌려준다 (이메일 인증은 나중에)', async () => {
    const { controller, betterAuth } = build();
    const result = await controller.signup({
      name: 'n', email: 'a@b.c', password: 'Passw0rd!x',
      consents: { ...consentsDto, ipAddress: '203.0.113.5', userAgent: 'ua' },
    });
    expect(betterAuth.signIn).toHaveBeenCalledWith('a@b.c', 'Passw0rd!x', { ip: '203.0.113.5', userAgent: 'ua' });
    expect(result).toMatchObject({ success: true, accessToken: 'jwt', refreshToken: 'sess', expiresIn: 3600, userId: 'u1' });
  });

  it('signup: 중복 이메일(합성 응답)이면 로그인하지 않고 토큰 없이 200 을 돌려준다', async () => {
    const { controller, betterAuth, authService } = build();
    authService.findUserByEmail.mockResolvedValue({ id: 'existing-user' });
    const result = await controller.signup({ name: 'n', email: 'a@b.c', password: 'Passw0rd!x', consents: { ...consentsDto } });
    expect(betterAuth.signIn).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, message: '인증 이메일이 발송되었습니다' });
  });

  it('signup: reCAPTCHA 토큰과 동의 페이로드의 IP·UA 를 평가에 넘기고, 평가는 signUp 보다 먼저 호출된다', async () => {
    const { controller, betterAuth, recaptcha } = build();
    await controller.signup({
      name: 'n', email: 'a@b.c', password: 'Passw0rd!x',
      consents: { ...consentsDto, ipAddress: '203.0.113.5', userAgent: 'ua' },
      recaptchaToken: 'tok',
    });
    expect(recaptcha.verifySignup).toHaveBeenCalledWith('tok', { ip: '203.0.113.5', userAgent: 'ua' });
    expect(recaptcha.verifySignup.mock.invocationCallOrder[0]).toBeLessThan(betterAuth.signUp.mock.invocationCallOrder[0]);
  });

  it('signup: 토큰이 없으면 undefined 를 그대로 넘긴다 (모드 판단은 서비스 책임)', async () => {
    const { controller, recaptcha } = build();
    await controller.signup({ name: 'n', email: 'a@b.c', password: 'Passw0rd!x', consents: { ...consentsDto } });
    expect(recaptcha.verifySignup).toHaveBeenCalledWith(undefined, { ip: undefined, userAgent: undefined });
  });

  it('signup: 평가가 거부하면 signUp·동의 기록을 하지 않고 예외를 그대로 전달한다', async () => {
    const { controller, betterAuth, consents, recaptcha } = build();
    recaptcha.verifySignup.mockRejectedValue(new ForbiddenException({ error: 'CAPTCHA_FAILED' }));
    await expect(controller.signup({ name: 'n', email: 'a@b.c', password: 'Passw0rd!x', consents: { ...consentsDto } }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(betterAuth.signUp).not.toHaveBeenCalled();
    expect(consents.recordSafely).not.toHaveBeenCalled();
  });

  it('verify-email 은 X-Session-Token 이 있으면 그 세션을 유지 대상으로 넘기고, 없으면 undefined 를 넘긴다', async () => {
    const { controller, betterAuth } = build();
    await controller.verifyEmail({ email: 'a@b.c', code: '123456' }, { 'x-session-token': 'sess' });
    expect(betterAuth.verifyEmail).toHaveBeenCalledWith('a@b.c', '123456', 'sess');
    await controller.verifyEmail({ email: 'a@b.c', code: '123456' }, {});
    expect(betterAuth.verifyEmail).toHaveBeenLastCalledWith('a@b.c', '123456', undefined);
  });
});
