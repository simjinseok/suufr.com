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

  @IsString()
  session!: string;

  @IsEmail()
  email!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;

  @IsString()
  username!: string;
}
