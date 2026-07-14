import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceSessionDto {
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

// "전액 입금 받음" — 청구 생성과 동시에 입금 1건 기록
export class CreateInvoiceInitialPaymentDto {
  @IsString()
  method!: string;

  @IsDateString()
  paidAt!: string;

  @IsInt()
  @IsOptional()
  amount?: number; // 생략 시 price 전액
}

export class CreateInvoiceDto {
  @IsUUID()
  studentUuid!: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsInt()
  @Min(0)
  price!: number;

  // 있으면 회차 수강권(잔여 관리·명시 귀속), 없으면 기간 정액(날짜 자동 귀속)
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

  // 명시적으로 지정한 세션들
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceSessionDto)
  @IsOptional()
  sessions?: CreateInvoiceSessionDto[];

  // 기존 미연결 세션을 이 청구에 귀속
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  sessionUuids?: string[];

  @ValidateNested()
  @Type(() => CreateInvoiceInitialPaymentDto)
  @IsOptional()
  initialPayment?: CreateInvoiceInitialPaymentDto;
}
