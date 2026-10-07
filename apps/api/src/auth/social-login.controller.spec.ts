import { SocialLoginController } from './social-login.controller';

/** better-auth 서비스는 mock. 브라우저로 나가는 응답(리다이렉트·set-cookie)만 검증한다 */
function build() {
  const betterAuth = {
    getSocialSignInUrl: vi.fn().mockResolvedValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc',
      setCookies: ['__Secure-better-auth.state=signed; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=Lax'],
    }),
  };
  const config = { get: vi.fn((key: string) => ({ WEB_URL: 'https://web.test', BETTER_AUTH_URL: 'https://api.test', NODE_ENV: 'production' })[key]) };
  const res = { header: vi.fn(), redirect: vi.fn(), status: vi.fn(), send: vi.fn() };
  const controller = new SocialLoginController({} as never, betterAuth as never, config as never);
  return { controller, betterAuth, res };
}

const signupQuery = { signup: '1', terms: 'true', privacy: 'true', termsVersion: '2026-07-08', privacyVersion: '2026-07-08' };

describe('SocialLoginController.start', () => {
  it('로그인 모드: state 쿠키를 싣고 Google 로 302 하며 신규 가입은 요청하지 않는다', async () => {
    const { controller, betterAuth, res } = build();
    await controller.start({ params: { provider: 'google' }, query: {} } as never, res as never);

    expect(betterAuth.getSocialSignInUrl).toHaveBeenCalledWith('google', {
      callbackURL: 'https://api.test/auth/social/google/complete',
      errorCallbackURL: 'https://web.test/login',
    });
    expect(res.header).toHaveBeenCalledWith('set-cookie', [expect.stringContaining('better-auth.state=signed')]);
    expect(res.redirect).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=abc', 302);
  });

  it('가입 모드: 신규 가입을 허용하고 신규 콜백 주소를 지정하며 동의 쿠키를 함께 심는다', async () => {
    const { controller, betterAuth, res } = build();
    await controller.start({ params: { provider: 'google' }, query: signupQuery } as never, res as never);

    expect(betterAuth.getSocialSignInUrl).toHaveBeenCalledWith('google', {
      callbackURL: 'https://api.test/auth/social/google/complete',
      errorCallbackURL: 'https://web.test/login',
      requestSignUp: true,
      newUserCallbackURL: 'https://api.test/auth/social/google/complete?new=1',
    });
    const [, cookies] = res.header.mock.calls[0];
    expect(cookies).toHaveLength(2);
    expect(cookies[1]).toContain('suufr.social_consent=2026-07-08|2026-07-08');
    expect(cookies[1]).toContain('Secure');
  });

  it('가입 모드인데 동의가 빠졌으면 Google 로 가지 않고 가입 폼으로 돌려보낸다', async () => {
    const { controller, betterAuth, res } = build();
    await controller.start({ params: { provider: 'google' }, query: { ...signupQuery, privacy: 'false' } } as never, res as never);

    expect(betterAuth.getSocialSignInUrl).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('https://web.test/signup?error=consent', 302);
  });

  it('지원하지 않는 provider 는 web 로그인 화면으로 돌려보낸다', async () => {
    const { controller, betterAuth, res } = build();
    await controller.start({ params: { provider: 'kakao' }, query: {} } as never, res as never);

    expect(betterAuth.getSocialSignInUrl).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('https://web.test/login?error=social', 302);
  });
});
