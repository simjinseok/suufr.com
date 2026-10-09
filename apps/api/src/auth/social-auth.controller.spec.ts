import { SocialAuthController } from './social-auth.controller';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '../common/constants/legal';

/** 서비스는 mock. 인계 코드에 담는 세션, 신규 가입자의 동의 기록, 쿠키 정리, 실패 분기와 코드 교환을 검증한다 */
function build() {
  const betterAuth = {
    readSocialCallbackCookies: vi.fn().mockResolvedValue({
      sessionToken: 'sess',
      userId: 'u1',
      expireCookies: ['better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax'],
    }),
    issueTokens: vi.fn().mockResolvedValue({ success: true, accessToken: 'jwt', refreshToken: 'sess', expiresIn: 3600, userId: 'u1' }),
  };
  const handoff = {
    create: vi.fn().mockResolvedValue('code-1'),
    consume: vi.fn().mockResolvedValue({ sessionToken: 'sess', userId: 'u1' }),
  };
  const consents = { recordSafely: vi.fn().mockResolvedValue(undefined) };
  const config = { get: vi.fn((key: string) => ({ WEB_URL: 'https://web.test' })[key]) };
  const res = { header: vi.fn(), redirect: vi.fn() };
  const controller = new SocialAuthController(betterAuth as never, handoff as never, consents as never, config as never);
  return { controller, betterAuth, handoff, consents, res };
}

const sessionCookie = 'better-auth.session_token=abc';

describe('SocialAuthController.complete', () => {
  it('기존 사용자 로그인은 동의를 기록하지 않고, 세션 토큰·userId 를 인계 코드로 저장해 web 으로 보낸다', async () => {
    const { controller, handoff, consents, res } = build();
    await controller.complete({ params: { provider: 'google' }, query: {} } as never, res as never, '1.1.1.1', sessionCookie, 'ua');

    expect(consents.recordSafely).not.toHaveBeenCalled();
    expect(handoff.create).toHaveBeenCalledWith({ sessionToken: 'sess', userId: 'u1' });
    expect(res.redirect).toHaveBeenCalledWith('https://web.test/auth/google/login?code=code-1', 302);
  });

  it('신규 가입자(new=1)는 현재 문서 버전과 실제 클라이언트 IP·UA 로 동의 이력을 남긴다', async () => {
    const { controller, consents, res } = build();
    await controller.complete({ params: { provider: 'google' }, query: { new: '1' } } as never, res as never, '203.0.113.5', sessionCookie, 'Mozilla');

    expect(consents.recordSafely).toHaveBeenCalledWith(
      'u1',
      { terms: true, privacy: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_POLICY_VERSION },
      { ipAddress: '203.0.113.5', userAgent: 'Mozilla' },
    );
    expect(res.redirect).toHaveBeenCalledWith('https://web.test/auth/google/login?code=code-1', 302);
  });

  it('api 도메인 세션 쿠키를 만료시킨다', async () => {
    const { controller, res } = build();
    await controller.complete({ params: { provider: 'google' }, query: {} } as never, res as never, '1.1.1.1', sessionCookie, 'ua');
    expect(res.header).toHaveBeenCalledWith('set-cookie', expect.stringContaining('better-auth.session_token=; Max-Age=0'));
  });

  it('지원하지 않는 provider 는 세션을 읽지 않고 web 로그인 화면으로 돌려보낸다', async () => {
    const { controller, betterAuth, handoff, res } = build();
    await controller.complete({ params: { provider: 'kakao' }, query: {} } as never, res as never, '1.1.1.1', sessionCookie, 'ua');

    expect(betterAuth.readSocialCallbackCookies).not.toHaveBeenCalled();
    expect(handoff.create).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('https://web.test/login?error=social', 302);
  });

  it('쿠키 없이 도착하면 세션을 읽지 않고 web 로그인 화면으로 돌려보낸다', async () => {
    const { controller, betterAuth, handoff, res } = build();
    await controller.complete({ params: { provider: 'google' }, query: {} } as never, res as never, '1.1.1.1', undefined, 'ua');

    expect(betterAuth.readSocialCallbackCookies).not.toHaveBeenCalled();
    expect(handoff.create).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('https://web.test/login?error=social', 302);
  });

  it('쿠키에서 세션을 읽지 못하면 동의·인계 코드 없이 web 로그인 화면으로 돌려보낸다', async () => {
    const { controller, betterAuth, handoff, consents, res } = build();
    betterAuth.readSocialCallbackCookies.mockResolvedValue(null);
    await controller.complete({ params: { provider: 'google' }, query: { new: '1' } } as never, res as never, '1.1.1.1', sessionCookie, 'ua');

    expect(consents.recordSafely).not.toHaveBeenCalled();
    expect(handoff.create).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('https://web.test/login?error=social', 302);
  });
});

describe('SocialAuthController.exchange', () => {
  it('코드로 꺼낸 세션 토큰·userId 로 토큰을 발급한다', async () => {
    const { controller, betterAuth, handoff } = build();
    const result = await controller.exchange({ code: 'code-1' });

    expect(handoff.consume).toHaveBeenCalledWith('code-1');
    expect(betterAuth.issueTokens).toHaveBeenCalledWith('sess', 'u1');
    expect(result).toEqual({ success: true, accessToken: 'jwt', refreshToken: 'sess', expiresIn: 3600, userId: 'u1' });
  });

  it('만료·재사용·위조 코드는 토큰을 발급하지 않고 실패로 응답한다', async () => {
    const { controller, betterAuth, handoff } = build();
    handoff.consume.mockResolvedValue(null);

    await expect(controller.exchange({ code: 'used' })).resolves.toEqual({ success: false, message: expect.any(String) });
    expect(betterAuth.issueTokens).not.toHaveBeenCalled();
  });
});
