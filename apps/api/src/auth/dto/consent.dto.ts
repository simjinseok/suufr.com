import { Equals, IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const DOC_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 약관·개인정보 동의 (가입 및 재동의 공용).
 * 세 동의 모두 필수(true)여야 한다. 문서 버전은 web 상수(constants/legal.ts)가 보낸 값.
 * ipAddress 는 형식 검증을 하지 않는다 — 형식 때문에 가입이 실패하면 안 되므로 web 에서 정규화해 보낸다.
 */
export class ConsentsDto {
  @IsBoolean()
  @Equals(true, { message: '이용약관에 동의해주세요' })
  terms!: boolean;

  @IsBoolean()
  @Equals(true, { message: '개인정보 수집·이용에 동의해주세요' })
  privacy!: boolean;

  @IsBoolean()
  @Equals(true, { message: '개인정보 국외 이전에 동의해주세요' })
  overseasTransfer!: boolean;

  @IsString()
  @Matches(DOC_VERSION_PATTERN)
  termsVersion!: string;

  @IsString()
  @Matches(DOC_VERSION_PATTERN)
  privacyVersion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(45)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}
