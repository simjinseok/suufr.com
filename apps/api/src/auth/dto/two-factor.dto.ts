import { IsString, Length, MinLength } from 'class-validator';

export class TwoFactorPasswordDto {
  @IsString({ message: '비밀번호를 입력해주세요' })
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다' })
  password!: string;
}

export class TwoFactorCodeDto {
  @IsString({ message: '인증 코드를 입력해주세요' })
  @Length(6, 6, { message: '인증 앱의 6자리 코드를 입력해주세요' })
  code!: string;
}

export class LogoutDto {
  @IsString()
  refreshToken!: string;
}
