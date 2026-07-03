import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { CognitoService } from './cognito.service';
import { S3Service } from '../s3/s3.service';
import {
  LoginDto,
  MfaDto,
  RefreshTokenDto,
  SignupDto,
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';

// 인증 엔드포인트 브루트포스 방어 (기본 10회/분/IP). 자주 호출되는 me/refresh/cookies는 @SkipThrottle.
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cognitoService: CognitoService,
    private readonly s3Service: S3Service,
  ) {}

  @SkipThrottle()
  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const orgData = await this.authService.getCurrentOrganization(user);
    const settings = await this.authService.getOrCreateUserSettings(user.userId);
    const organizations = await this.authService.getUserOrganizations(user.userId);

    return {
      user: {
        id: user.userId,
        email: user.email,
        name: user.username,
      },
      organization: orgData?.organization ?? null,
      organizations,
      settings,
    };
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.cognitoService.login(dto.email, dto.password);
  }

  @Public()
  @Post('mfa')
  async mfa(@Body() dto: MfaDto) {
    return this.cognitoService.respondToMfa(dto.email, dto.code, dto.session);
  }

  @Public()
  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.cognitoService.signup(dto.name, dto.email, dto.password);
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.cognitoService.verifyEmail(dto.email, dto.code);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.cognitoService.resendVerification(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.cognitoService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.cognitoService.resetPassword(dto.email, dto.code, dto.password);
  }

  @SkipThrottle()
  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.cognitoService.refreshToken(dto.refreshToken, dto.username);
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
