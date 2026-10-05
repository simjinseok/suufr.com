import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PASSWORD_POLICY, PASSWORD_POLICY_MESSAGE } from './password-policy';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class MfaDto {
  @IsString()
  code!: string;

  @IsString()
  session!: string;

  @IsEmail()
  email!: string;
}

export class NewPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  session!: string;

  @IsString()
  @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;

  // Cognito refresh 에만 필요 (SECRET_HASH 계산). better-auth 세션 토큰이면 생략 가능
  @IsOptional()
  @IsString()
  username?: string;
}
