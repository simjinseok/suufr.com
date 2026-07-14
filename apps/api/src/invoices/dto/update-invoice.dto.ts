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

  @IsDateString()
  @IsOptional()
  periodStart?: string;

  @IsDateString()
  @IsOptional()
  periodEnd?: string;

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
