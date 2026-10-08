import { IsString, IsOptional, IsUUID, IsArray } from 'class-validator';

export class CreateCurriculumItemDto {
  @IsUUID()
  curriculumUuid!: string;

  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  mediaFileUuids?: string[]; // 첨부할 파일 UUID 목록

  @IsUUID()
  @IsOptional()
  sectionUuid?: string; // 넣을 섹션. 없으면 섹션 없음 묶음
}
