import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { Public } from '../../common/decorators/public.decorator';
import type { Auth } from './better-auth.provider';
import { BETTER_AUTH } from './auth.constants';

/**
 * better-auth HTTP 핸들러 마운트 (/api/better-auth/*).
 * web 은 지금 이 경로를 직접 쓰지 않는다(AuthController 가 auth.api 를 서버에서 호출).
 * 추후 소셜 로그인 콜백(/callback/:id)·JWKS 공개(/jwks) 를 위해 미리 열어 둔다.
 */
@Public()
@Controller('api/better-auth')
export class BetterAuthController {
  constructor(@Inject(BETTER_AUTH) private readonly auth: Auth) {}

  @All('*')
  async handle(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const url = new URL(req.url, `${req.protocol}://${req.headers.host ?? 'localhost'}`);
    const headers = fromNodeHeaders(req.headers);
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined && req.body !== null;

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      ...(hasBody ? { body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body) } : {}),
    });

    const response = await this.auth.handler(request);

    res.status(response.status);
    response.headers.forEach((value, key) => {
      // Fastify 는 set-cookie 를 배열로 받아야 여러 개를 보낼 수 있다
      if (key.toLowerCase() === 'set-cookie') return;
      res.header(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.header('set-cookie', cookies);

    return res.send(response.body ? await response.text() : null);
  }
}
