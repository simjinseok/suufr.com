import { SocialLoginController } from './social-login.controller';

/** better-auth 서비스는 mock. 브라우저로 나가는 응답(리다이렉트·set-cookie)만 검증한다 */
function build() {
  const betterAuth = {
    getSocialSignInUrl: vi.fn().mockResolvedValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc',
      setCookies: ['__Secure-better-auth.state=signed; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=Lax'],
    }),
  };
  const config = { get: vi.fn((key: string) => ({ WEB_URL: 'https://web.test', BETTER_AUTH_URL: 'https://api.test', })[key]) };
  const res = { header: vi.fn(), redirect: vi.fn(), status: vi.fn(), send: vi.fn() };
  const controller = new SocialLoginController({} as never, betterAuth as never, config as never);
  return { controller, betterAuth, res };
}

describe('SocialLoginController.start', () => {
  it('state 쿠키를 싣고 Google 로 302 하며, 신규 가입자는 complete?new=1 로 오도록 지정한다', async () => {
    const { controller, betterAuth, res } = build();
    await controller.start({ params: { provider: 'google' }, query: {} } as never, res as never);

    expect(betterAuth.getSocialSignInUrl).toHaveBeenCalledWith('google', {
      callbackURL: 'https://api.test/auth/social/google/complete',
      errorCallbackURL: 'https://web.test/login',
      newUserCallbackURL: 'https://api.test/auth/social/google/complete?new=1',
    });
    expect(res.header).toHaveBeenCalledWith('set-cookie', [expect.stringContaining('better-auth.state=signed')]);
    expect(res.redirect).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=abc', 302);
  });

  it('지원하지 않는 provider 는 web 로그인 화면으로 돌려보낸다', async () => {
    const { controller, betterAuth, res } = build();
    await controller.start({ params: { provider: 'kakao' }, query: {} } as never, res as never);

    expect(betterAuth.getSocialSignInUrl).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('https://web.test/login?error=social', 302);
  });
});
