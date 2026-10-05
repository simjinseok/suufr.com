import { IsEmail, IsString, MinLength } from 'class-validator';

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

  // 로그인 응답의 session (two_factor 쿠키 쌍)
  @IsString()
  session!: string;
}

export class RefreshTokenDto {
  // refresh_token 쿠키 값 (better-auth 세션 토큰)
  @IsString()
  refreshToken!: string;
}
