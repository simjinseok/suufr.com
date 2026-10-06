import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
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

  // null 이면 기간 삭제, undefined 면 미변경. 시작·종료는 둘 다 있거나 둘 다 없어야 한다(서비스에서 검증)
  @IsDateString()
  @IsOptional()
  periodStart?: string | null;

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
