import { Body, Controller, Get, Headers, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../common/decorators/public.decorator';
import { BetterAuthService, type IssuedTokens } from './better-auth/better-auth.service';
import { SocialHandoffService } from './social-handoff.service';
import { SocialExchangeDto } from './dto';
import { isSupportedSocialProvider } from './social-providers';

/**
 * 소셜 로그인 (현재 Google) 의 후반부. 앞부분(시작·Google 콜백)은 SocialLoginController(/auth/*) 가 맡는다.
 *
 *  1. GET  /auth/google/start     브라우저 → state 쿠키를 받고 Google 로 (SocialLoginController)
 *  2. GET  /auth/google/callback  Google → better-auth 가 state·쿠키 검증 후 api 도메인에 세션 또는 2FA 쿠키 설정 (SocialLoginController)
 *  3. GET  complete               브라우저가 api 쿠키와 함께 도착. 결과를 일회용 코드로 저장하고 api 쿠키를 지운 뒤 web 콜백으로 리다이렉트
 *  4. POST exchange               web 서버가 코드를 교환해 JWT·세션 토큰(또는 2FA 챌린지)을 받는다
 */
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('api/auth/social')
export class SocialAuthController {
  constructor(
    private readonly betterAuth: BetterAuthService,
    private readonly handoff: SocialHandoffService,
    private readonly config: ConfigService,
  ) {}

  private get webUrl(): string {
    return this.config.get<string>('WEB_URL') || 'http://localhost:3000';
  }

  /** 브라우저 요청. api 도메인 쿠키(세션 또는 two_factor)를 읽어 인계 코드로 바꾸고 web 으로 보낸다 */
  @Public()
  @Get(':provider/complete')
  async complete(@Req() req: FastifyRequest, @Res() res: FastifyReply, @Headers('cookie') cookie?: string) {
    const provider = (req.params as { provider: string }).provider;
    const webCallback = `${this.webUrl}/auth/${provider}/login`;
    const fail = () => res.redirect(`${this.webUrl}/login?error=social`, 302);

    if (!isSupportedSocialProvider(provider) || !cookie) return fail();

    const result = await this.betterAuth.readSocialCallbackCookies(cookie);
    if (!result) return fail();

    const code = await this.handoff.create(result.kind === 'session'
      ? { kind: 'session', sessionToken: result.sessionToken, userId: result.userId }
      : { kind: 'mfa', cookiePairs: result.cookiePairs });

    // api 도메인에 남은 better-auth 쿠키는 더 쓰이지 않으므로 지운다 (세션 자체는 web 이 이어받는다)
    for (const line of result.expireCookies) res.header('set-cookie', line);
    return res.redirect(`${webCallback}?code=${encodeURIComponent(code)}`, 302);
  }

  @Public()
  @Post('exchange')
  async exchange(@Body() dto: SocialExchangeDto): Promise<
    IssuedTokens | { success: true; requiresMfa: true; challengeName: 'TOTP'; session: string } | { success: false; message: string }
  > {
    const payload = await this.handoff.consume(dto.code);
    if (!payload) return { success: false, message: '로그인 확인이 만료되었습니다. 다시 시도해주세요.' };

    if (payload.kind === 'mfa') {
      return { success: true, requiresMfa: true, challengeName: 'TOTP', session: payload.cookiePairs };
    }
    return this.betterAuth.issueTokens(payload.sessionToken, payload.userId);
  }
}
