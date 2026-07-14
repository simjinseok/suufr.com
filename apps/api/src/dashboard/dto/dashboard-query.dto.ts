import { IsOptional, IsTimeZone } from 'class-validator';

export class DashboardQueryDto {
  /** "이번 달"/"오늘" 경계를 계산할 IANA 타임존. 미지정 시 유저 설정 > UTC 순으로 해석. */
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
