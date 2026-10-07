import { Controller, Get, Inject, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { Public } from '../common/decorators/public.decorator';
import type { Auth } from './better-auth/better-auth.provider';
import { BETTER_AUTH, BETTER_AUTH_BASE_PATH } from './better-auth/auth.constants';
import { BetterAuthService } from './better-auth/better-auth.service';
import { isSupportedSocialProvider } from './social-providers';
import { NEW_USER_QUERY_KEY, buildSocialConsentCookie, parseSocialConsentQuery } from './social-consent-cookie';

/** Google 콘솔에 등록하는 리디렉션 URI 경로. auth.config 의 google.redirectURI 와 같아야 한다 */
export const GOOGLE_LOGIN_CALLBACK_PATH = '/auth/google/callback';

/**
 * 소셜 로그인의 브라우저 진입점.
 *
 *  GET /auth/:provider/start   web 의 Google 버튼이 브라우저를 여기로 보낸다. better-auth 가 state 를 DB 에 저장하면서
 *                              서명된 state 쿠키도 발급하는데, 콜백에서 그 쿠키를 대조하므로 (login CSRF 방어) 시작 요청은
 *                              반드시 브라우저가 api 도메인에 직접 보내야 한다. 여기서 쿠키를 실어 Google 로 302 한다.
 *                              기본은 로그인 전용(기존 계정만). 가입 폼은 ?signup=1 과 동의값(terms·privacy·버전)을 붙여 오고,
 *                              그때만 신규 가입을 허용하며 동의값을 쿠키로 심어 complete 에서 이력으로 기록한다.
 *                              미가입자가 로그인 전용으로 오면 better-auth 가 web /login?error=signup_disabled 로 돌려보낸다.
 *  GET /auth/google/callback   Google 이 돌아오는 곳. better-auth 의 /callback/google 로 그대로 넘긴다 — state·쿠키 검증,
 *                              토큰 교환, 사용자 생성/연결 후 api 도메인에 세션(또는 2FA) 쿠키를 심고
 *                              SocialAuthController.complete 로 리다이렉트한다.
 */
// 사용자당 시작·콜백 각 1회가 정상이라 넉넉히 두되, state 추측 시도는 막는다
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60000 } })
@Public()
@Controller('auth')
export class SocialLoginController {
  constructor(
    @Inject(BETTER_AUTH) private readonly auth: Auth,
    private readonly betterAuth: BetterAuthService,
    private readonly config: ConfigService,
  ) {}

  private get webUrl(): string {
    return this.config.get<string>('WEB_URL') || 'http://localhost:3000';
  }

  private get apiUrl(): string {
    return this.config.get<string>('BETTER_AUTH_URL') || '';
  }

  private get secureCookies(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  @Get(':provider/start')
  async start(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const provider = (req.params as { provider: string }).provider;
    if (!isSupportedSocialProvider(provider)) return res.redirect(`${this.webUrl}/login?error=social`, 302);

    const query = (req.query ?? {}) as Record<string, unknown>;
    const isSignup = query.signup === '1';
    const consent = isSignup ? parseSocialConsentQuery(query) : null;
    // 가입 모드인데 동의가 빠졌다 — 폼은 동의 전 버튼을 비활성화하므로 조작된 요청이다. 가입 폼으로 돌려보낸다
    if (isSignup && !consent) return res.redirect(`${this.webUrl}/signup?error=consent`, 302);

    const completeUrl = `${this.apiUrl}/auth/social/${provider}/complete`;
    const { url, setCookies } = await this.betterAuth.getSocialSignInUrl(provider, {
      callbackURL: completeUrl,
      // better-auth 가 ?error=<code> 를 덧붙인다 (signup_disabled, state_mismatch 등). web 로그인 폼이 코드별로 안내한다
      errorCallbackURL: `${this.webUrl}/login`,
      ...(consent
        ? { requestSignUp: true, newUserCallbackURL: `${completeUrl}?${NEW_USER_QUERY_KEY}=1` }
        : {}),
    });
    // Fastify 는 set-cookie 를 배열로 받아야 여러 개를 보낼 수 있다
    const cookies = consent ? [...setCookies, buildSocialConsentCookie(consent, this.secureCookies)] : setCookies;
    if (cookies.length) res.header('set-cookie', cookies);
    return res.redirect(url, 302);
  }

  @Get('google/callback')
  async callback(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const incoming = new URL(req.url, `${req.protocol}://${req.headers.host ?? 'localhost'}`);
    const internal = new URL(`${BETTER_AUTH_BASE_PATH}/callback/google`, incoming.origin);
    internal.search = incoming.search;

    const response = await this.auth.handler(new Request(internal.toString(), { method: 'GET', headers: fromNodeHeaders(req.headers) }));

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') return;
      res.header(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.header('set-cookie', cookies);

    return res.send(response.body ? await response.text() : null);
  }
}
