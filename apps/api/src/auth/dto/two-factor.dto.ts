import { IsString, Length, MinLength } from 'class-validator';

export class TwoFactorPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}

export class TwoFactorCodeDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class LogoutDto {
  @IsString()
  refreshToken!: string;
}
