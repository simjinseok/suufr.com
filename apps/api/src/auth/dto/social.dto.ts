import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ConsentsDto } from './consent.dto';

/** iOS Google Sign-In SDK 가 발급한 ID 토큰(JWT). audience 는 서버 클라이언트 ID 여야 한다 */
export class GoogleNativeLoginDto {
  @IsString()
  @MaxLength(4096)
  idToken!: string;

  // 가입 화면에서 왔을 때만 싣는다. 있으면 신규 가입을 허용하고 동의 이력을 기록한다. 없으면 기존 계정 로그인만 된다
  @IsOptional()
  @ValidateNested()
  @Type(() => ConsentsDto)
  consents?: ConsentsDto;
}

export class SocialExchangeDto {
  @IsString()
  @MaxLength(128)
  code!: string;
}
