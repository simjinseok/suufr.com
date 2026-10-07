import { SocialAuthController } from './social-auth.controller';

vi.mock('@sentry/nestjs', () => ({ captureMessage: vi.fn() }));

/** 서비스는 mock. 신규 가입자의 동의 기록과 쿠키 정리만 검증한다 */
function build() {
  const betterAuth = {
    readSocialCallbackCookies: vi.fn().mockResolvedValue({
      sessionToken: 'sess',
      userId: 'u1',
      expireCookies: ['better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax'],
    }),
  };
  const handoff = { create: vi.fn().mockResolvedValue('code-1') };
  const consents = { recordSafely: vi.fn().mockResolvedValue(undefined) };
  const config = { get: vi.fn((key: string) => ({ WEB_URL: 'https://web.test', NODE_ENV: 'test' })[key]) };
  const res = { header: vi.fn(), redirect: vi.fn() };
  const controller = new SocialAuthController(betterAuth as never, handoff as never, consents as never, config as never);
  return { controller, consents, res };
}

const sessionCookie = 'better-auth.session_token=abc';
const consentCookie = 'suufr.social_consent=2026-07-08|2026-07-01';

describe('SocialAuthController.complete', () => {
  it('기존 사용자 로그인은 동의를 기록하지 않고 인계 코드와 함께 web 으로 보낸다', async () => {
    const { controller, consents, res } = build();
    await controller.complete({ params: { provider: 'google' }, query: {} } as never, res as never, '1.1.1.1', `${sessionCookie}; ${consentCookie}`, 'ua');

    expect(consents.recordSafely).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('https://web.test/auth/google/login?code=code-1', 302);
  });

  it('신규 가입자(new=1)는 동의 쿠키의 버전과 실제 클라이언트 IP·UA 로 동의 이력을 남긴다', async () => {
    const { controller, consents, res } = build();
    await controller.complete({ params: { provider: 'google' }, query: { new: '1' } } as never, res as never, '203.0.113.5', `${sessionCookie}; ${consentCookie}`, 'Mozilla');

    expect(consents.recordSafely).toHaveBeenCalledWith(
      'u1',
      { terms: true, privacy: true, termsVersion: '2026-07-08', privacyVersion: '2026-07-01' },
      { ipAddress: '203.0.113.5', userAgent: 'Mozilla' },
    );
  });

  it('신규 가입자인데 동의 쿠키가 없으면 기록 없이 진행한다 (경고만)', async () => {
    const { controller, consents, res } = build();
    await controller.complete({ params: { provider: 'google' }, query: { new: '1' } } as never, res as never, '1.1.1.1', sessionCookie, 'ua');

    expect(consents.recordSafely).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('https://web.test/auth/google/login?code=code-1', 302);
  });

  it('세션 쿠키와 동의 쿠키를 모두 만료시킨다', async () => {
    const { controller, res } = build();
    await controller.complete({ params: { provider: 'google' }, query: {} } as never, res as never, '1.1.1.1', sessionCookie, 'ua');

    const [, cookies] = res.header.mock.calls[0];
    expect(cookies).toEqual([
      expect.stringContaining('better-auth.session_token=; Max-Age=0'),
      expect.stringContaining('suufr.social_consent=; Max-Age=0'),
    ]);
  });
});
