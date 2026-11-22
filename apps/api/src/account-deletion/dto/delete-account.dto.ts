import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * 계정 삭제 재인증. 비밀번호가 있는 계정(/auth/me user.hasPassword)은 password, 아니면 이메일로 받은 otp.
 * 어느 쪽이 필요한지는 서비스가 판단한다 (빠지면 ACCOUNT_DELETE_REAUTH_REQUIRED).
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
}
