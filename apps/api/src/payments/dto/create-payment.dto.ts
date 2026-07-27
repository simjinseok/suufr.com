import { IsString, IsOptional, IsUUID, IsDateString, IsInt, IsArray, NotEquals } from 'class-validator';

// 입금 1건 기록. 음수 = 환불. 학생 직속 (청구와 연결하지 않는다)
export class CreatePaymentDto {
  @IsInt()
  @NotEquals(0)
  amount!: number;

  @IsString()
  method!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  paidAt!: string;

  @IsUUID()
  studentUuid!: string;

  // 이 입금이 커버하는 수강권 (§6-22 순수 연결 — 금액 배분 없음)
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  invoiceUuids?: string[];
}
