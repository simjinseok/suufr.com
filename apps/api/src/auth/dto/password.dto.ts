import { IsEmail, IsString, Matches } from 'class-validator';
import { PASSWORD_POLICY, PASSWORD_POLICY_MESSAGE } from './password-policy';

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  code!: string;

  @IsString()
  @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  password!: string;
}
