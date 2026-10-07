import { Controller, Get, Post, Body, UseGuards, Headers, Ip, UnauthorizedException } from '@nestjs/common';
import { ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { ConsentsService } from './consents.service';
import { BetterAuthService, type RequestMeta } from './better-auth/better-auth.service';
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

  private requireSessionToken(headers: Record<string, string | string[] | undefined>): string {
    const raw = headers[SESSION_TOKEN_HEADER];
    const token = Array.isArray(raw) ? raw[0] : raw;
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
   * 가입. reCAPTCHA 평가를 먼저 통과해야 users 행·인증 메일이 만들어진다 (RECAPTCHA_MODE 참고).
   * 평가에 쓰는 IP·UA 는 web 이 동의 페이로드로 전달한 실제 클라이언트 값이다 (api 가 보는 IP 는 web 서버).
   * 동의 이력은 생성된 users.id 로 기록한다.
   * 중복 이메일이면 better-auth 가 열거 방지용 합성 사용자(무작위 id)를 돌려주므로, users 에 그 id 가 실제로 있을 때만 기록한다.
   * 실제로 생성됐으면 바로 로그인해 토큰까지 돌려준다 (이메일 인증은 나중에). 중복이면 토큰 없이 메시지만 — 응답 모양으로
   * 가입 여부가 드러나지만, reCAPTCHA·레이트리밋을 믿고 가입 즉시 로그인을 택했다 (2026-10-07 확정).
   */
  @Public()
  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    await this.recaptcha.verifySignup(dto.recaptchaToken, {
      ip: dto.consents.ipAddress,
      userAgent: dto.consents.userAgent,
    });

    const { userId } = await this.betterAuth.signUp(dto.name?.trim() ?? '', dto.email, dto.password);

    const message = '인증 이메일이 발송되었습니다';
    const created = await this.authService.findUserByEmail(dto.email);
    // 중복 이메일(합성 사용자). 가입 즉시 로그인이라 토큰 유무로 가입 여부가 드러나므로(2026-10-07 확정) 안내도 사실대로 한다
    if (!created || created.id !== userId) return { success: true, message: '이미 가입된 이메일입니다. 로그인해주세요.' };

    await this.consentsService.recordSafely(userId, dto.consents, {
      ipAddress: dto.consents.ipAddress,
      userAgent: dto.consents.userAgent,
    });

    // 새 계정이라 2FA 챌린지는 나올 수 없지만, 타입상 토큰 응답일 때만 싣는다
    const signedIn = await this.betterAuth.signIn(dto.email, dto.password, {
      ip: dto.consents.ipAddress,
      userAgent: dto.consents.userAgent,
    });
    if ('requiresMfa' in signedIn) return { success: true, message };
    return { ...signedIn, message };
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.betterAuth.verifyEmail(dto.email, dto.code);
    return { success: true, message: '이메일 인증이 완료되었습니다' };
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
  async enableTwoFactor(@Body() dto: TwoFactorPasswordDto, @Headers() headers: Record<string, string | undefined>) {
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
