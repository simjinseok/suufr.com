import { IsString, IsOptional, IsDateString, IsInt, Min, IsArray, IsUUID, IsEnum } from 'class-validator';
import { SessionStatusValue } from '@prisma/generated/client';

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

  @IsEnum(SessionStatusValue)
  @IsOptional()
  status?: SessionStatusValue;

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
