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
}
