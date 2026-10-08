import { IsString, IsOptional, IsArray, IsUUID, ValidateIf } from 'class-validator';

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

  // null 이면 섹션에서 빼서 섹션 없음 묶음으로. undefined 면 소속 유지.
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  @IsOptional()
  sectionUuid?: string | null;
}
