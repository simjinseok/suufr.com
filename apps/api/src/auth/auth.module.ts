import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CognitoService } from './cognito.service';

@Module({
  controllers: [AuthController],
  providers: [JwtAuthGuard, AuthService, CognitoService],
  exports: [JwtAuthGuard, AuthService, CognitoService],
})
export class AuthModule {}
