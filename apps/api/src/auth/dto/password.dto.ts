import { IsEmail, IsString, Matches } from 'class-validator';
import { PASSWORD_POLICY, PASSWORD_POLICY_MESSAGE } from './password-policy';

export class ForgotPasswordDto {
  @IsEmail({}, { message: '유효한 이메일을 입력해주세요' })
  email!: string;
}

export class ResetPasswordDto {
  @IsEmail({}, { message: '유효한 이메일을 입력해주세요' })
  email!: string;

  @IsString({ message: '인증코드를 입력해주세요' })
  code!: string;

  @IsString()
  @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  password!: string;
}
