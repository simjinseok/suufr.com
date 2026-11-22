import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * 계정 삭제 재인증. 비밀번호가 있는 계정(/auth/me user.hasPassword)은 password, 아니면 이메일로 받은 otp.
 * 어느 쪽이 필요한지는 서비스가 판단한다 (빠지면 ACCOUNT_DELETE_REAUTH_REQUIRED).
 * appleAuthorizationCode: Apple 계정이 연결돼 있는데 저장된 refresh token 이 없을 때(ACCOUNT_DELETE_APPLE_REAUTH_REQUIRED)
 * iOS 가 Apple 재인증으로 받아 보내는 authorization code. 서버가 교환한 토큰을 폐기한다.
 */
export class DeleteAccountDto {
  @IsOptional()
  @IsString({ message: '비밀번호를 입력해주세요' })
  @MaxLength(128, { message: '비밀번호는 128자 이하여야 합니다' })
  password?: string;

  @IsOptional()
  @IsString({ message: '인증코드를 입력해주세요' })
  @Matches(/^\d{6}$/, { message: '이메일로 받은 6자리 인증코드를 입력해주세요' })
  otp?: string;

  @IsOptional()
  @IsString({ message: 'Apple 인증 정보가 올바르지 않습니다' })
  @MaxLength(2048, { message: 'Apple 인증 정보가 올바르지 않습니다' })
  appleAuthorizationCode?: string;
}
