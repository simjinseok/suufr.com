import { IsString, IsOptional, IsArray, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMediaFileDto } from './create-curriculum-item.dto';

export class UpdateCurriculumItemDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

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
