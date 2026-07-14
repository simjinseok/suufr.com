import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  IsTimeZone,
  Min,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const MAX_BULK_SESSIONS = 50;

export class BulkSessionItemDto {
  @IsDateString()
  sessionAt!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

// 요일·시간·횟수로 만든 수업 여러 건을 한 번에 생성 (한 트랜잭션)
export class CreateSessionsBulkDto {
  @IsUUID()
  studentUuid!: string;

  // 명시 귀속. 생략 시 세션별로 기간 정액 청구에 날짜 기준 자동 귀속
  @IsUUID()
  @IsOptional()
  invoiceUuid?: string;

  // 날짜 기반 자동 귀속의 날짜 경계를 계산할 IANA 타임존. 생략 시 유저 설정 > UTC 순으로 해석
  @IsTimeZone()
  @IsOptional()
  timezone?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_SESSIONS)
  @ValidateNested({ each: true })
  @Type(() => BulkSessionItemDto)
  sessions!: BulkSessionItemDto[];

  // 마지막 수업 다음 회차의 날짜 ("YYYY-MM-DD", 달력 날짜).
  // 설정(autoUpdateNextPaymentAt)이 켜져 있으면 학생의 다음 결제 예정일로 반영한다.
  @IsDateString()
  @IsOptional()
  nextPaymentAt?: string;
}
