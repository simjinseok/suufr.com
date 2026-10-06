import { Matches, IsDefined, IsEmail, IsString, MinLength, ValidateNested } from 'class-validator';
import { PASSWORD_POLICY, PASSWORD_POLICY_MESSAGE } from './password-policy';
import { Type } from 'class-transformer';
import { ConsentsDto } from './consent.dto';

export class SignupDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  password!: string;

  // 이용약관·개인정보 수집·이용 동의 (모두 필수)
  // @ValidateNested 는 undefined 를 통과시키므로 @IsDefined 가 꼭 필요하다
  @IsDefined()
  @ValidateNested()
  @Type(() => ConsentsDto)
  consents!: ConsentsDto;
}

export class VerifyEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  code!: string;
}

export class ResendVerificationDto {
  @IsEmail()
  email!: string;
}
