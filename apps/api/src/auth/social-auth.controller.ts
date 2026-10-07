import { Body, Controller, Get, Headers, Ip, Logger, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../common/decorators/public.decorator';
import { BetterAuthService, type IssuedTokens } from './better-auth/better-auth.service';
import { SocialHandoffService } from './social-handoff.service';
import { SocialExchangeDto } from './dto';
import { isSupportedSocialProvider } from './social-providers';
import { ConsentsService } from './consents.service';
import { NEW_USER_QUERY_KEY, expireSocialConsentCookie, readSocialConsentCookie } from './social-consent-cookie';

/**
 * 소셜 로그인 (현재 Google) 의 후반부. 앞부분(시작·Google 콜백)은 SocialLoginController(/auth/*) 가 맡는다.
 *
 *  1. GET  /auth/google/start     브라우저 → state 쿠키를 받고 Google 로 (SocialLoginController)
 *  2. GET  /auth/google/callback  Google → better-auth 가 state·쿠키 검증 후 api 도메인에 세션 쿠키 설정 (SocialLoginController)
 *  3. GET  complete               브라우저가 api 쿠키와 함께 도착. 결과를 일회용 코드로 저장하고 api 쿠키를 지운 뒤 web 콜백으로 리다이렉트.
 *                                 신규 가입자(?new=1, better-auth newUserCallbackURL)는 start 가 심은 동의 쿠키로 동의 이력을 기록한다
 *  4. POST exchange               web 서버가 코드를 교환해 JWT·세션 토큰을 받는다. 2단계 인증은 Google 이 본인 확인을 끝낸 뒤라 묻지 않는다
 */
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('auth/social')
export class SocialAuthController {
  private readonly logger = new Logger(SocialAuthController.name);

  constructor(
    private readonly betterAuth: BetterAuthService,
    private readonly handoff: SocialHandoffService,
    private readonly consents: ConsentsService,
    private readonly config: ConfigService,
  ) {}

  private get webUrl(): string {
    return this.config.get<string>('WEB_URL') || 'http://localhost:3000';
  }

  private get secureCookies(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  /** 브라우저 요청. api 도메인 세션 쿠키를 읽어 인계 코드로 바꾸고 web 으로 보낸다 */
  @Public()
  @Get(':provider/complete')
  async complete(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Ip() ip: string,
    @Headers('cookie') cookie?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const provider = (req.params as { provider: string }).provider;
    const webCallback = `${this.webUrl}/auth/${provider}/login`;
    const fail = () => res.redirect(`${this.webUrl}/login?error=social`, 302);

    if (!isSupportedSocialProvider(provider) || !cookie) return fail();

    const result = await this.betterAuth.readSocialCallbackCookies(cookie);
    if (!result) return fail();

    // 신규 가입자: start 가 심은 동의값을 이력으로 남긴다. 이 요청은 브라우저가 직접 보내므로 IP·UA 가 실제 클라이언트 값이다
    const isNewUser = (req.query as Record<string, unknown> | undefined)?.[NEW_USER_QUERY_KEY] === '1';
    if (isNewUser) {
      const consent = readSocialConsentCookie(cookie);
      if (consent) {
        await this.consents.recordSafely(result.userId, { terms: true, privacy: true, ...consent }, { ipAddress: ip, userAgent });
      }
      else {
        // requestSignUp 은 동의 쿠키와 같은 응답에서만 켜지므로 정상 흐름에선 없을 수 없다. Google 화면에 15분 넘게 머문 경우뿐
        this.logger.warn(`신규 Google 가입자의 동의 쿠키가 없음 (userId=${result.userId})`);
        Sentry.captureMessage('social signup without consent cookie', { level: 'warning', extra: { userId: result.userId } });
      }
    }

    const code = await this.handoff.create({ sessionToken: result.sessionToken, userId: result.userId });

    // api 도메인에 남은 better-auth 쿠키와 동의 쿠키는 더 쓰이지 않으므로 지운다 (세션 자체는 web 이 이어받는다)
    res.header('set-cookie', [...result.expireCookies, expireSocialConsentCookie(this.secureCookies)]);
    return res.redirect(`${webCallback}?code=${encodeURIComponent(code)}`, 302);
  }

  @Public()
  @Post('exchange')
  async exchange(@Body() dto: SocialExchangeDto): Promise<IssuedTokens | { success: false; message: string }> {
    const payload = await this.handoff.consume(dto.code);
    if (!payload) return { success: false, message: '로그인 확인이 만료되었습니다. 다시 시도해주세요.' };
    return this.betterAuth.issueTokens(payload.sessionToken, payload.userId);
  }
}
