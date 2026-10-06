import { Controller, Get, Inject, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { Public } from '../common/decorators/public.decorator';
import type { Auth } from './better-auth/better-auth.provider';
import { BETTER_AUTH, BETTER_AUTH_BASE_PATH } from './better-auth/auth.constants';

/** Google 콘솔에 등록하는 리디렉션 URI 경로. auth.config 의 google.redirectURI 와 같아야 한다 */
export const GOOGLE_LOGIN_CALLBACK_PATH = '/auth/google/callback';

/**
 * Google 로그인 콜백 (GET /auth/google/callback — /health, /webhooks 처럼 /api 접두사 없는 외부 진입점).
 * better-auth 의 OAuth 콜백 엔드포인트(/callback/google)로 요청을 그대로 넘긴다 — 외부에는 이 경로만 보인다.
 * better-auth 가 state 검증·토큰 교환·사용자 생성/연결 후 api 도메인에 세션(또는 2FA) 쿠키를 심고
 * SocialAuthController.complete 로 리다이렉트한다.
 */
// Google 이 보내는 리다이렉트 1회뿐이라 넉넉히 두되, state 추측 시도는 막는다
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60000 } })
@Public()
@Controller('auth/google')
export class GoogleLoginCallbackController {
  constructor(@Inject(BETTER_AUTH) private readonly auth: Auth) {}

  @Get('callback')
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
    // Fastify 는 set-cookie 를 배열로 받아야 여러 개를 보낼 수 있다
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.header('set-cookie', cookies);

    return res.send(response.body ? await response.text() : null);
  }
}
