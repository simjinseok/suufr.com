import { IsString, IsOptional, IsUUID, IsDateString, IsInt, IsTimeZone, Min, IsArray } from 'class-validator';

export class CreateSessionDto {
  @IsDateString()
  sessionAt!: string;

  // 날짜 기반 자동 귀속의 날짜 경계를 계산할 IANA 타임존. 생략 시 유저 설정 > UTC 순으로 해석
  @IsTimeZone()
  @IsOptional()
  timezone?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  studentUuid!: string;

  // 명시 귀속. 생략 시 monthly/period 청구는 날짜 기준 자동 귀속 (docs/schema-redesign.md §3)
  @IsUUID()
  @IsOptional()
  invoiceUuid?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  mediaFileUuids?: string[]; // 첨부할 파일 UUID 목록
}
