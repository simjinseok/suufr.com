import { IsString, IsOptional, IsDateString, IsInt, Min, IsBoolean, IsArray, IsUUID } from 'class-validator';

export class UpdateSessionDto {
  @IsDateString()
  @IsOptional()
  sessionAt?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isDone?: boolean;

  // 청구 재귀속 (해제는 invoices PATCH의 removeSessionUuids 사용)
  @IsUUID()
  @IsOptional()
  invoiceUuid?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  addMediaFileUuids?: string[]; // 추가할 파일 UUID들

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  removeMediaFileUuids?: string[]; // 연결 해제할 파일 UUID들
}
