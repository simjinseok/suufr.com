import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
  ValidateIf,
} from 'class-validator';

export class UpdateInvoiceDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  totalCount?: number;

  // 시작일은 지울 수 없다 — undefined 면 미변경, null 은 거부(IsOptional 은 null 도 통과시키므로 ValidateIf 로 막는다)
  @ValidateIf(o => o.periodStart !== undefined)
  @IsDateString()
  periodStart?: string;

  // null 이면 종료일 삭제(무기한), undefined 면 미변경. 시작일 <= 종료일은 서비스에서 검증
  @IsDateString()
  @IsOptional()
  periodEnd?: string | null;

  @IsBoolean()
  @IsOptional()
  autoRenew?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  renewDaysBefore?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  // 세션 귀속 추가/해제
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  addSessionUuids?: string[];

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  removeSessionUuids?: string[];
}
