import { Body, Controller, Get, Headers, Ip, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../common/decorators/public.decorator';
import { BetterAuthService, type IssuedTokens } from './better-auth/better-auth.service';
import { SocialHandoffService } from './social-handoff.service';
import { SocialExchangeDto } from './dto';
import { isSupportedSocialProvider } from './social-providers';
import { ConsentsService } from './consents.service';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '../common/constants/legal';

/** 신규 가입자 콜백(complete?new=1)을 구분하는 쿼리 키. SocialLoginController.start 가 better-auth newUserCallbackURL 에 붙인다 */
export const NEW_USER_QUERY_KEY = 'new';

/**
 * 소셜 로그인 (현재 Google) 의 후반부. 앞부분(시작·Google 콜백)은 SocialLoginController(/auth/*) 가 맡는다.
 *
 *  1. GET  /auth/google/start     브라우저 → state 쿠키를 받고 Google 로 (SocialLoginController)
 *  2. GET  /auth/google/callback  Google → better-auth 가 state·쿠키 검증 후 api 도메인에 세션 쿠키 설정 (SocialLoginController)
 *  3. GET  complete               브라우저가 api 쿠키와 함께 도착. 결과를 일회용 코드로 저장하고 api 쿠키를 지운 뒤 web 콜백으로 리다이렉트.
 *                                 신규 가입자(?new=1, better-auth newUserCallbackURL)는 현재 문서 버전으로 동의 이력을 기록한다 —
 *                                 약관·방침 고지는 Google 동의 화면이 보여준 링크로 갈음한다(체크박스 없음)
 *  4. POST exchange               web 서버가 코드를 교환해 JWT·세션 토큰을 받는다. 2단계 인증은 Google 이 본인 확인을 끝낸 뒤라 묻지 않는다
 */
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('auth/social')
export class SocialAuthController {
  constructor(
    private readonly betterAuth: BetterAuthService,
    private readonly handoff: SocialHandoffService,
    private readonly consents: ConsentsService,
    private readonly config: ConfigService,
  ) {}

  private get webUrl(): string {
    return this.config.get<string>('WEB_URL') || 'http://localhost:3000';
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

    // 신규 가입자: 현재 문서 버전으로 동의 이력을 남긴다. 이 요청은 브라우저가 직접 보내므로 IP·UA 가 실제 클라이언트 값이다
    const isNewUser = (req.query as Record<string, unknown> | undefined)?.[NEW_USER_QUERY_KEY] === '1';
    if (isNewUser) {
      await this.consents.recordSafely(
        result.userId,
        { terms: true, privacy: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_POLICY_VERSION },
        { ipAddress: ip, userAgent },
      );
    }

    const code = await this.handoff.create({ sessionToken: result.sessionToken, userId: result.userId });

    // api 도메인에 남은 better-auth 쿠키는 더 쓰이지 않으므로 지운다 (세션 자체는 web 이 이어받는다)
    for (const line of result.expireCookies) res.header('set-cookie', line);
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
