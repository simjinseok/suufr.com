import { Matches, IsDefined, IsEmail, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { PASSWORD_POLICY, PASSWORD_POLICY_MESSAGE } from './password-policy';
import { Type } from 'class-transformer';
import { ConsentsDto } from './consent.dto';

export class SignupDto {
  // 웹 가입 폼은 받지 않는다. 기존 iOS 앱이 보내는 값만 받아 과외방 이름 초기값에 쓴다 (없으면 이메일 앞부분)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsEmail({}, { message: '유효한 이메일을 입력해주세요' })
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

  // reCAPTCHA Enterprise 토큰(web 가입 폼). 없으면 RECAPTCHA_MODE 가 처리를 정한다 (iOS 는 아직 보내지 않는다)
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  recaptchaToken?: string;
}

export class VerifyEmailDto {
  @IsEmail({}, { message: '유효한 이메일을 입력해주세요' })
  email!: string;

  @IsString({ message: '인증코드를 입력해주세요' })
  code!: string;
}

export class ResendVerificationDto {
  @IsEmail({}, { message: '유효한 이메일을 입력해주세요' })
  email!: string;
}
