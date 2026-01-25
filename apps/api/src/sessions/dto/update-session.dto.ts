import { IsString, IsOptional, IsDateString, IsInt, Min, IsBoolean, IsArray, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMediaFileDto } from './create-session.dto';

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
  @ValidateNested({ each: true })
  @Type(() => CreateMediaFileDto)
  @IsOptional()
  addNewMediaFiles?: CreateMediaFileDto[]; // 새로 업로드할 파일들 (temp URL)

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  addExistingMediaFileUuids?: string[]; // 기존 파일 연결 (재활용)

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  removeMediaFileUuids?: string[]; // 연결 해제할 파일 UUID들
}
