import { IsString, MaxLength } from 'class-validator';

/** iOS Google Sign-In SDK 가 발급한 ID 토큰(JWT). audience 는 서버 클라이언트 ID 여야 한다 */
export class GoogleNativeLoginDto {
  @IsString()
  @MaxLength(4096)
  idToken!: string;
}

export class SocialExchangeDto {
  @IsString()
  @MaxLength(128)
  code!: string;
}
