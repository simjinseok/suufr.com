import { SocialLoginController } from './social-login.controller';
import { BETTER_AUTH_BASE_PATH } from './better-auth/auth.constants';

/** better-auth 는 mock. 브라우저로 나가는 응답(리다이렉트·set-cookie)과 better-auth 로 넘기는 요청만 검증한다 */
function build(auth: object = {}) {
  const betterAuth = {
    getSocialSignInUrl: vi.fn().mockResolvedValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc',
      setCookies: ['__Secure-better-auth.state=signed; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=Lax'],
    }),
  };
  const config = { get: vi.fn((key: string) => ({ WEB_URL: 'https://web.test', BETTER_AUTH_URL: 'https://api.test' })[key]) };
  const res = { header: vi.fn(), redirect: vi.fn(), status: vi.fn(), send: vi.fn() };
  const controller = new SocialLoginController(auth as never, betterAuth as never, config as never);
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

describe('SocialLoginController.callback', () => {
  it('Google 콜백을 쿼리·쿠키째 better-auth /callback/google 로 넘기고, 응답의 set-cookie 여러 개는 합치거나 겹치지 않게 하나씩 싣는다', async () => {
    const headers = new Headers({ location: 'https://api.test/auth/social/google/complete' });
    headers.append('set-cookie', 'better-auth.session_token=s; Path=/; HttpOnly');
    headers.append('set-cookie', '__Secure-better-auth.state=; Max-Age=0; Path=/');
    const handler = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers }));
    const { controller, res } = build({ handler });

    await controller.callback(
      { url: '/auth/google/callback?state=abc&code=xyz', protocol: 'https', headers: { host: 'api.test', cookie: '__Secure-better-auth.state=signed' } } as never,
      res as never,
    );

    const forwarded = handler.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe(`https://api.test${BETTER_AUTH_BASE_PATH}/callback/google?state=abc&code=xyz`);
    expect(forwarded.headers.get('cookie')).toBe('__Secure-better-auth.state=signed');
    expect(res.status).toHaveBeenCalledWith(302);
    expect(res.header).toHaveBeenCalledWith('location', 'https://api.test/auth/social/google/complete');
    // Fastify 는 set-cookie 를 다시 넣으면 이어 붙이므로 호출 형태(배열 한 번이든 쿠키마다든)는 상관없고, 최종 쿠키 목록만 본다
    const setCookies = res.header.mock.calls.filter(([key]) => key === 'set-cookie').flatMap(([, value]) => [value].flat());
    expect(setCookies).toEqual(['better-auth.session_token=s; Path=/; HttpOnly', '__Secure-better-auth.state=; Max-Age=0; Path=/']);
  });
});
