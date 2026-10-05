import { Controller, Get, Post, Body, UseGuards, Headers, Ip, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { CognitoService } from './cognito.service';
import { CognitoMigrationService } from './cognito-migration.service';
import { ConsentsService } from './consents.service';
import { BetterAuthService, type RequestMeta } from './better-auth/better-auth.service';
import { S3Service } from '../s3/s3.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  LoginDto,
  MfaDto,
  NewPasswordDto,
  RefreshTokenDto,
  SignupDto,
  ConsentsDto,
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  LogoutDto,
  TwoFactorPasswordDto,
  TwoFactorCodeDto,
} from './dto';

/** web 이 2FA 관리·로그아웃처럼 세션이 필요한 요청에 refresh_token 쿠키(=세션 토큰)를 담아 보내는 헤더 */
const SESSION_TOKEN_HEADER = 'x-session-token';

/**
 * 인증 엔드포인트. web 과의 계약(경로·요청·응답 형태)은 Cognito 시절 그대로 두고 구현만 better-auth 로 교체했다.
 * 이전 기간(Phase 4~5) 동안 아래 규칙으로 Cognito 와 병행한다:
 *   - 가입/인증코드/로그인: better-auth. 로그인은 lazy migration 훅이 미이전 사용자를 Cognito 로 검증해 옮긴다.
 *   - 비밀번호 찾기/재설정, 이메일 인증: better-auth 사용자(users 행 있음)면 better-auth, 아니면 Cognito 레거시.
 *   - refresh: 토큰 형태로 판별 (Cognito refresh token 은 점(.) 포함 JWE, better-auth 세션 토큰은 점 없음).
 *   - MFA 챌린지: Cognito 세션 문자열이면 Cognito, two_factor 쿠키 쌍이면 better-auth.
 * 브루트포스 방어 (기본 10회/분/IP). 자주 호출되는 me/refresh/cookies 는 @SkipThrottle.
 */
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cognitoService: CognitoService,
    private readonly migration: CognitoMigrationService,
    private readonly betterAuth: BetterAuthService,
    private readonly consentsService: ConsentsService,
    private readonly s3Service: S3Service,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly config: ConfigService,
  ) {}

  private get lazyMigrationEnabled(): boolean {
    return (this.config.get<string>('AUTH_LAZY_MIGRATION') ?? 'true') !== 'false';
  }

  /** users 행이 없는 이메일만 Cognito 레거시 경로로 보낸다 (이전 기간 한정) */
  private async useCognitoFor(email: string): Promise<boolean> {
    if (!this.lazyMigrationEnabled) return false;
    return (await this.migration.findUserByEmail(email)) === null;
  }

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

  /**
   * 약관·개인정보 재동의 기록 (기존 가입자, 방침 개정 후).
   * /me 의 consents.required 가 true 인 동안 web 이 재동의 모달을 띄우고 이 엔드포인트로 제출한다.
   */
  @Post('consents')
  async submitConsents(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConsentsDto) {
    await this.consentsService.record(user.userId, dto, {
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
    });
    return { success: true, consents: await this.consentsService.getStatus(user.userId) };
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    const meta: RequestMeta = { ip, userAgent };
    return this.betterAuth.signIn(dto.email, dto.password, meta);
  }

  /** 로그인 2단계. session 이 better-auth two_factor 쿠키 쌍이면 TOTP/백업코드, 아니면 Cognito SOFTWARE_TOKEN_MFA 세션 */
  @Public()
  @Post('mfa')
  async mfa(@Body() dto: MfaDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    if (dto.session.includes('two_factor=')) {
      return this.betterAuth.verifySecondFactor(dto.session, dto.code, { ip, userAgent });
    }
    return this.cognitoService.respondToMfa(dto.email, dto.code, dto.session);
  }

  /**
   * NEW_PASSWORD_REQUIRED 챌린지 완료 (Cognito 임시 비밀번호 계정). 레거시 — Cognito 에 새 비밀번호를 설정하고
   * 같은 비밀번호를 better-auth 에도 기록해 즉시 이전한다.
   */
  @Public()
  @Post('new-password')
  async newPassword(@Body() dto: NewPasswordDto) {
    const result = await this.cognitoService.respondToNewPassword(dto.email, dto.password, dto.session);
    await this.migration.migrateCredential({
      sub: result.cognitoUsername,
      email: dto.email,
      password: dto.password,
      cognitoMfaEnabled: false,
    });
    // 발급은 better-auth 토큰으로 통일 — Cognito 토큰을 새로 심지 않는다
    return this.betterAuth.signIn(dto.email, dto.password);
  }

  /**
   * 가입은 better-auth 로만 받는다. 동의 이력은 생성된 users.id 로 기록한다.
   * 중복 이메일이면 better-auth 가 열거 방지용 합성 사용자(무작위 id)를 돌려주므로, users 에 그 id 가 실제로 있을 때만 기록한다.
   */
  @Public()
  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    const { userId } = await this.betterAuth.signUp(dto.name, dto.email, dto.password);

    const created = await this.migration.findUserByEmail(dto.email);
    if (created && created.id === userId) {
      await this.consentsService.recordSafely(userId, dto.consents, {
        ipAddress: dto.consents.ipAddress,
        userAgent: dto.consents.userAgent,
      });
    }

    return { success: true, message: '인증 이메일이 발송되었습니다' };
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    if (await this.useCognitoFor(dto.email)) {
      return this.cognitoService.verifyEmail(dto.email, dto.code);
    }
    await this.betterAuth.verifyEmail(dto.email, dto.code);
    return { success: true, message: '이메일 인증이 완료되었습니다' };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    if (await this.useCognitoFor(dto.email)) {
      return this.cognitoService.resendVerification(dto.email);
    }
    await this.betterAuth.resendVerification(dto.email);
    return { success: true, message: '인증코드가 재발송되었습니다' };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    if (await this.useCognitoFor(dto.email)) {
      return this.cognitoService.forgotPassword(dto.email);
    }
    await this.betterAuth.requestPasswordReset(dto.email);
    return { success: true, message: '비밀번호 재설정 코드가 이메일로 발송되었습니다' };
  }

  /** 미이전 사용자의 Cognito 재설정은 성공 시 better-auth 에도 같은 비밀번호를 기록해 즉시 이전한다 */
  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const user = await this.migration.findUserByEmail(dto.email);
    const hasCredential = user ? await this.migration.hasCredentialAccount(dto.email) : false;

    if (this.lazyMigrationEnabled && !hasCredential) {
      const result = await this.cognitoService.resetPassword(dto.email, dto.code, dto.password);
      const outcome = await this.migration.verifyWithCognito(dto.email, dto.password);
      if (outcome.kind === 'authenticated' || outcome.kind === 'mfa-required') {
        await this.migration.migrateCredential({
          sub: user?.id ?? outcome.sub,
          email: dto.email,
          name: 'name' in outcome ? outcome.name : undefined,
          password: dto.password,
          cognitoMfaEnabled: outcome.kind === 'mfa-required',
        });
      }
      return result;
    }

    await this.betterAuth.resetPassword(dto.email, dto.code, dto.password);
    return { success: true, message: '비밀번호가 재설정되었습니다' };
  }

  /** refresh_token 쿠키 값으로 새 access_token. Cognito refresh token(JWE, 점 포함) / better-auth 세션 토큰(점 없음) 판별 */
  @SkipThrottle()
  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    if (dto.refreshToken.includes('.')) {
      if (!dto.username) throw new BadRequestException('username 이 필요합니다');
      return this.cognitoService.refreshToken(dto.refreshToken, dto.username);
    }
    return this.betterAuth.refresh(dto.refreshToken);
  }

  /** 서버 세션 폐기. access_token 이 이미 만료됐을 수 있으므로 @Public + 본문의 세션 토큰으로 처리 */
  @SkipThrottle()
  @Public()
  @Post('logout')
  async logout(@Body() dto: LogoutDto) {
    if (!dto.refreshToken.includes('.')) {
      await this.betterAuth.signOut(dto.refreshToken);
    }
    return { success: true };
  }

  // ---- 2단계 인증 (TOTP) 관리: JWT 로 인증된 사용자 + X-Session-Token 헤더(세션 토큰) ----

  @Post('two-factor/enable')
  async enableTwoFactor(@Body() dto: TwoFactorPasswordDto, @Headers() headers: Record<string, string | undefined>) {
    const result = await this.betterAuth.enableTwoFactor(this.requireSessionToken(headers), dto.password);
    return { success: true, ...result };
  }

  @Post('two-factor/verify-setup')
  async verifyTwoFactorSetup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    await this.betterAuth.verifyTwoFactorSetup(this.requireSessionToken(headers), dto.code);
    await this.authService.clearTwoFactorSetupRequirement(user.userId);
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
