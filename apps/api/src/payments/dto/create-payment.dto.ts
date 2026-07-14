import { IsString, IsOptional, IsUUID, IsDateString, IsInt, NotEquals } from 'class-validator';

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
}
