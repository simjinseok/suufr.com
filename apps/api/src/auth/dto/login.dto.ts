import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: '유효한 이메일을 입력해주세요' })
  email!: string;

  @IsString({ message: '비밀번호를 입력해주세요' })
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다' })
  password!: string;
}

export class MfaDto {
  @IsString({ message: '인증 코드를 입력해주세요' })
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
