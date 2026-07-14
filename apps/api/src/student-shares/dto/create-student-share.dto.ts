import { IsUUID, IsBoolean, IsOptional } from 'class-validator';

export class CreateStudentShareDto {
  @IsUUID()
  studentUuid!: string;

  // 결제 섹션(다음결제예정일·납부상태) 노출 여부 — per-share 토글
  @IsBoolean()
  @IsOptional()
  showPayments?: boolean;
}
