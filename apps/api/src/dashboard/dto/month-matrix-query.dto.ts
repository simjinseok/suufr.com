import { IsOptional, IsTimeZone, Matches } from 'class-validator';

export class MonthMatrixQueryDto {
  /** 'YYYY-MM'. 미지정 시 유저 타임존의 이번 달. */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;

  /** 월 경계·세션 날짜를 계산할 IANA 타임존. 미지정 시 유저 설정 > UTC 순으로 해석. */
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
