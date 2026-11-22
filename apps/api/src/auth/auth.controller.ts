import { Controller, Get, Post, Body, UseGuards, Headers, Ip, UnauthorizedException, ForbiddenException, HttpException } from '@nestjs/common';
import { ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { ConsentsService } from './consents.service';
import { BetterAuthService, type RequestMeta } from './better-auth/better-auth.service';
import { MAIL_DELIVERY_FAILED } from './better-auth/better-auth-error.map';
import { S3Service } from '../s3/s3.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { RecaptchaService } from '../recaptcha/recaptcha.service';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '../common/constants/legal';
import {
  LoginDto,
  MfaDto,
  RefreshTokenDto,
  SignupDto,
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  LogoutDto,
  TwoFactorPasswordDto,
  TwoFactorCodeDto,
  GoogleNativeLoginDto,
  AppleNativeLoginDto,
} from './dto';

/** web 이 2FA 관리·로그아웃처럼 세션이 필요한 요청에 refresh_token 쿠키(=세션 토큰)를 담아 보내는 헤더 */
const SESSION_TOKEN_HEADER = 'x-session-token';

/**
 * 인증 엔드포인트. web 은 이 컨트롤러만 호출하고, 구현은 better-auth(auth.api.*) 다.
 * 브루트포스 방어 (기본 10회/분/IP). 자주 호출되는 me/refresh/cookies 는 @SkipThrottle.
 */
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly betterAuth: BetterAuthService,
    private readonly consentsService: ConsentsService,
    private readonly s3Service: S3Service,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly recaptcha: RecaptchaService,
  ) {}

  private optionalSessionToken(headers: Record<string, string | string[] | undefined>): string | undefined {
    const raw = headers[SESSION_TOKEN_HEADER];
    const token = Array.isArray(raw) ? raw[0] : raw;
    return token || undefined;
  }

  private requireSessionToken(headers: Record<string, string | string[] | undefined>): string {
    const token = this.optionalSessionToken(headers);
    if (!token) throw new UnauthorizedException('세션 토큰이 필요합니다');
    return token;
  }

  @SkipThrottle()
  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const orgData = await this.authService.getCurrentOrganization(user);
    const settings = await this.authService.getOrCreateUserSettings(user.userId);
    const organizations = await this.authService.getUserOrganizations(user.userId);
    const subscription = await this.subscriptionsService.getEntitlements(user.userId);
    const consents = await this.consentsService.getStatus(user.userId);
    const security = await this.authService.getSecurityStatus(user.userId);

    return {
      user: {
        id: user.userId,
        email: user.email,
        name: user.username,
        ...security,
      },
      organization: orgData?.organization ?? null,
      organizations,
      settings,
      subscription,
      consents,
    };
  }

  /**
   * 비밀번호 로그인. 이메일 미인증 계정은 비밀번호가 맞으면 403 EMAIL_NOT_VERIFIED 로 거부되고 인증코드 메일이 간다
   * (better-auth requireEmailVerification + sendOnSignIn). 클라이언트는 인증코드 화면으로 보낸다.
   * 그 메일을 못 보내면 403 대신 503 MAIL_DELIVERY_FAILED 다 — 클라이언트는 이때도 인증 화면에서 다시 받게 안내한다.
   * 비밀번호가 틀리면 인증 여부와 관계없이 같은 401 이다. 이 판정은 2단계 인증보다 먼저다.
   */
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    const meta: RequestMeta = { ip, userAgent };
    return this.betterAuth.signIn(dto.email, dto.password, meta);
  }

  /** 로그인 2단계: 인증 앱 TOTP 또는 백업코드. session 은 로그인 응답의 two_factor 쿠키 쌍 */
  @Public()
  @Post('mfa')
  async mfa(@Body() dto: MfaDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.betterAuth.verifySecondFactor(dto.session, dto.code, { ip, userAgent });
  }

  /**
   * iOS 네이티브 Google 로그인. Google Sign-In SDK 가 받은 ID 토큰(audience = 서버 클라이언트 ID)을 세션으로 바꾼다.
   * 응답은 login 성공 응답과 같다(토큰). 소셜 로그인이라 2단계 인증은 묻지 않는다. 브라우저 방식은 /auth/google/start 참고.
   * 기존 계정이면 로그인, 없으면 가입이다. 약관·방침 고지는 Google 동의 화면이 맡고, 동의 이력이 없는 사용자(신규 가입자)에게
   * 현재 문서 버전으로 이력을 남긴다. 이 요청은 iOS 가 직접 보내므로 IP·UA 가 실제 클라이언트 값이다.
   */
  @Public()
  @Post('google/native')
  async googleNativeLogin(@Body() dto: GoogleNativeLoginDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    const tokens = await this.betterAuth.signInWithGoogleIdToken(dto.idToken, { ip, userAgent });
    await this.consentsService.recordIfAbsent(
      tokens.userId,
      { terms: true, privacy: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_POLICY_VERSION },
      { ipAddress: ip, userAgent },
    );
    return tokens;
  }

  /**
   * iOS 네이티브 Sign in with Apple. identity token(+ 원문 nonce)을 세션으로 바꾼다. 응답은 login 성공 응답과 같다(토큰).
   * 소셜 로그인이라 2단계 인증은 묻지 않는다. 기존 계정이면 로그인, 없으면 가입이다. authorizationCode 가 있으면 탈퇴 시 revoke 용
   * refresh token 을 저장한다. Apple 시트에는 약관 링크가 없지만 기존 소셜 로그인 정책대로 고지 문구 없이, 동의 이력이 없는 사용자에게
   * 현재 문서 버전으로 이력을 남긴다. 브라우저 방식은 없다(SUPPORTED_SOCIAL_PROVIDERS 에 apple 없음).
   */
  @Public()
  @Post('apple/native')
  async appleNativeLogin(@Body() dto: AppleNativeLoginDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    const tokens = await this.betterAuth.signInWithAppleIdToken(dto, { ip, userAgent });
    await this.consentsService.recordIfAbsent(
      tokens.userId,
      { terms: true, privacy: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_POLICY_VERSION },
      { ipAddress: ip, userAgent },
    );
    return tokens;
  }

  /**
   * 가입. reCAPTCHA 평가를 먼저 통과해야 users 행·인증 메일이 만들어진다 (RECAPTCHA_MODE 참고).
   * 평가에 쓰는 IP·UA 는 web 이 동의 페이로드로 전달한 실제 클라이언트 값이다 (api 가 보는 IP 는 web 서버).
   * 동의 이력은 생성된 users.id 로 기록한다.
   * 중복 이메일이면 better-auth 가 열거 방지용 합성 사용자(무작위 id)를 돌려주므로, users 에 그 id 가 실제로 있을 때만 기록한다.
   * 가입만으로는 로그인되지 않는다. 새 계정이면 requiresVerification 을 돌려주고, 클라이언트는 인증코드 화면으로 간다
   * (인증하면 verify-email 이 토큰을 준다). 중복 이메일이면 인증 화면으로 보내지 않고 로그인 안내만 한다 —
   * 응답으로 가입 여부가 드러나는 것은 2026-10-07 확정 사항이다.
   */
  @Public()
  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    await this.recaptcha.verifySignup(dto.recaptchaToken, {
      ip: dto.consents.ipAddress,
      userAgent: dto.consents.userAgent,
    });

    const consentMeta = { ipAddress: dto.consents.ipAddress, userAgent: dto.consents.userAgent };
    let userId: string;
    try {
      ({ userId } = await this.betterAuth.signUp(dto.name?.trim() ?? '', dto.email, dto.password));
    }
    catch (error) {
      // 인증 메일만 못 보낸 경우 계정은 이미 만들어졌다. 클라이언트는 인증 화면으로 가고 인증하면 바로 앱에 들어가므로,
      // 동의 이력을 먼저 남기고 같은 에러를 돌려준다 (중복 이메일에는 인증 메일을 보내지 않으므로 찾은 계정은 이번에 만든 것이다)
      if (error instanceof HttpException && (error.getResponse() as { error?: string }).error === MAIL_DELIVERY_FAILED) {
        const created = await this.authService.findUserByEmail(dto.email);
        if (created) await this.consentsService.recordSafely(created.id, dto.consents, consentMeta);
      }
      throw error;
    }

    const created = await this.authService.findUserByEmail(dto.email);
    // 중복 이메일(합성 사용자)
    if (!created || created.id !== userId) return { success: true, message: '이미 가입된 이메일입니다. 로그인해주세요.' };

    await this.consentsService.recordSafely(userId, dto.consents, consentMeta);

    return { success: true, requiresVerification: true, message: '인증 이메일이 발송되었습니다' };
  }

  /**
   * 이메일 인증. 소유권 증명 전 세션을 폐기한다(로그인 상태의 호출자는 X-Session-Token 을 보내야 자기 세션이 유지된다).
   * 미인증이던 계정이면 토큰까지 돌려준다(인증 즉시 로그인). 이미 인증됐거나 2단계 인증을 켠 계정은 토큰 없이
   * 성공만 알리고, 클라이언트는 로그인 화면으로 보낸다.
   */
  @Public()
  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Ip() ip: string,
  ) {
    const userAgent = headers['user-agent'];
    const tokens = await this.betterAuth.verifyEmail(dto.email, dto.code, this.optionalSessionToken(headers), {
      ip,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    });
    const message = '이메일 인증이 완료되었습니다';
    return tokens ? { ...tokens, message } : { success: true, message };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.betterAuth.resendVerification(dto.email);
    return { success: true, message: '인증코드가 재발송되었습니다' };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.betterAuth.requestPasswordReset(dto.email);
    return { success: true, message: '비밀번호 재설정 코드가 이메일로 발송되었습니다' };
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.betterAuth.resetPassword(dto.email, dto.code, dto.password);
    return { success: true, message: '비밀번호가 재설정되었습니다' };
  }

  /** refresh_token 쿠키 값(세션 토큰)으로 새 access_token */
  @SkipThrottle()
  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.betterAuth.refresh(dto.refreshToken);
  }

  /** 서버 세션 폐기. access_token 이 이미 만료됐을 수 있으므로 @Public + 본문의 세션 토큰으로 처리 */
  @SkipThrottle()
  @Public()
  @Post('logout')
  async logout(@Body() dto: LogoutDto) {
    await this.betterAuth.signOut(dto.refreshToken);
    return { success: true };
  }

  // ---- 2단계 인증 (TOTP) 관리: JWT 로 인증된 사용자 + X-Session-Token 헤더(세션 토큰) ----

  @Post('two-factor/enable')
  async enableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorPasswordDto,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    // 미인증 비밀번호 계정은 로그인이 막혀 여기 올 수 없지만, 혹시 남은 세션이 있어도 막는다(Google 전용 사용자는 통과)
    if (await this.betterAuth.isUnverifiedPasswordUser(user.userId)) {
      throw new ForbiddenException({ message: '이메일 인증을 마친 뒤 2단계 인증을 설정할 수 있습니다', error: 'EMAIL_NOT_VERIFIED' });
    }
    const result = await this.betterAuth.enableTwoFactor(this.requireSessionToken(headers), dto.password);
    return { success: true, ...result };
  }

  @Post('two-factor/verify-setup')
  async verifyTwoFactorSetup(@Body() dto: TwoFactorCodeDto, @Headers() headers: Record<string, string | undefined>) {
    await this.betterAuth.verifyTwoFactorSetup(this.requireSessionToken(headers), dto.code);
    return { success: true, message: '2단계 인증이 활성화되었습니다' };
  }

  @Post('two-factor/disable')
  async disableTwoFactor(@Body() dto: TwoFactorPasswordDto, @Headers() headers: Record<string, string | undefined>) {
    await this.betterAuth.disableTwoFactor(this.requireSessionToken(headers), dto.password);
    return { success: true, message: '2단계 인증이 해제되었습니다' };
  }

  @Post('two-factor/backup-codes')
  async regenerateBackupCodes(@Body() dto: TwoFactorPasswordDto, @Headers() headers: Record<string, string | undefined>) {
    const backupCodes = await this.betterAuth.regenerateBackupCodes(this.requireSessionToken(headers), dto.password);
    return { success: true, backupCodes };
  }

  /**
   * CloudFront Signed Cookies 발급
   * 인증된 사용자의 users/{userId}/* 경로에 대한 접근 권한을 쿠키 값으로 반환
   */
  @SkipThrottle()
  @Post('cloudfront/cookies')
  async getSignedCookies(@CurrentUser() user: AuthenticatedUser) {
    const cookies = this.s3Service.getSignedCookiesForUser(user.userId);

    if (!cookies) {
      // CloudFront signing이 설정되지 않은 경우
      return { success: true, configured: false };
    }

    return {
      success: true,
      configured: true,
      cookies: {
        'CloudFront-Policy': cookies['CloudFront-Policy'],
        'CloudFront-Signature': cookies['CloudFront-Signature'],
        'CloudFront-Key-Pair-Id': cookies['CloudFront-Key-Pair-Id'],
      },
      cookieOptions: {
        domain: process.env.CLOUDFRONT_COOKIE_DOMAIN,
        maxAge: 86400, // 초 단위 (24시간)
      },
    };
  }
}
