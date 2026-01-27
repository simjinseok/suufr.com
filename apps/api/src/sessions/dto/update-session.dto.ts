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

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  addMediaFileUuids?: string[]; // 추가할 파일 UUID들

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  removeMediaFileUuids?: string[]; // 연결 해제할 파일 UUID들
}
