import { IsUUID, IsBoolean, IsOptional } from 'class-validator';
import { StrictBoolean } from '../../common/decorators/strict-boolean.decorator';

export class CreateStudentShareDto {
  @IsUUID()
  studentUuid!: string;

  // 결제 섹션(다음결제예정일·납부상태) 노출 여부 — per-share 토글
  @IsBoolean()
  @StrictBoolean()
  @IsOptional()
  showPayments?: boolean;
}
