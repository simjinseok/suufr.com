import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** iOS Google Sign-In SDK 가 발급한 ID 토큰(JWT). audience 는 서버 클라이언트 ID 여야 한다 */
export class GoogleNativeLoginDto {
  @IsString()
  @MaxLength(4096)
  idToken!: string;
}

/** iOS AuthenticationServices 가 받은 Sign in with Apple 결과 */
export class AppleNativeLoginDto {
  // identity token(JWT). aud 는 앱 번들 ID
  @IsString()
  @MaxLength(4096)
  idToken!: string;

  // 원문 nonce(필수). iOS 는 이 값의 SHA-256 을 Apple 요청에 넣었고, 서버는 토큰의 nonce 클레임이 SHA-256(원문)일 때만 받는다.
  // 원문은 기기 밖으로 나가지 않으므로, 가로챈 identity token 만으로는(클레임 값을 그대로 보내도) 로그인할 수 없다
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  nonce!: string;

  // 5분·1회용 authorization code. 탈퇴 시 revoke 용 refresh token 교환에만 쓴다
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  authorizationCode?: string;

  // 최초 승인 때만 오는 이름(iOS 가 기기 로캘 순서로 조합). SignupDto.name 과 같은 길이 제한
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

export class SocialExchangeDto {
  @IsString()
  @MaxLength(128)
  code!: string;
}
