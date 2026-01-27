import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

export class UpdateCurriculumItemDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  addMediaFileUuids?: string[]; // 추가할 파일 UUID들

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  removeMediaFileUuids?: string[]; // 연결 해제할 파일 UUID들
}
