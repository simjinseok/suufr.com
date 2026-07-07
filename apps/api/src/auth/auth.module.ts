import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CognitoService } from './cognito.service';
import { S3Module } from '../s3/s3.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [S3Module, SubscriptionsModule],
  controllers: [AuthController],
  providers: [JwtAuthGuard, AuthService, CognitoService],
  exports: [JwtAuthGuard, AuthService, CognitoService],
})
export class AuthModule {}
