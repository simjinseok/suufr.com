import { IsBoolean, IsOptional } from 'class-validator';
import { StrictBoolean } from '../../common/decorators/strict-boolean.decorator';

export class MarkDoneDto {
  // 없으면 완료로 본다 (본문 없이 보내던 기존 클라이언트)
  @IsBoolean()
  @StrictBoolean()
  @IsOptional()
  isDone?: boolean;

  @IsBoolean()
  @StrictBoolean()
  @IsOptional()
  isAbsent?: boolean;
}
