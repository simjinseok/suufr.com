import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ConsentsService } from './consents.service';
import { UserProvisioningService } from './user-provisioning.service';
import { BetterAuthService } from './better-auth/better-auth.service';
import { BetterAuthController } from './better-auth/better-auth.controller';
import { betterAuthProvider } from './better-auth/better-auth.provider';
import { MailModule } from '../mail/mail.module';
import { S3Module } from '../s3/s3.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [S3Module, SubscriptionsModule, MailModule],
  controllers: [AuthController, BetterAuthController],
  providers: [
    JwtAuthGuard,
    AuthService,
    ConsentsService,
    UserProvisioningService,
    betterAuthProvider,
    BetterAuthService,
  ],
  exports: [JwtAuthGuard, AuthService, BetterAuthService],
})
export class AuthModule {}
