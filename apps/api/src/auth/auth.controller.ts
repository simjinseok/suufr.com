import { Controller, Get, Post, Body } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { CognitoService } from './cognito.service';
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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cognitoService: CognitoService,
  ) {}

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

  @Public()
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.cognitoService.resendVerification(dto.email);
  }

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

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.cognitoService.refreshToken(dto.refreshToken, dto.username);
  }
}
