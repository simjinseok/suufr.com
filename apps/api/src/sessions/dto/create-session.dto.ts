import { IsString, IsOptional, IsUUID, IsDateString, IsInt, Min, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMediaFileDto {
  @IsString()
  url!: string; // temp URL (suufr/temp/xxx)

  @IsString()
  publicId!: string;

  @IsIn(['image', 'video'])
  type!: 'image' | 'video';

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsInt()
  @Min(1)
  fileSize!: number; // 바이트 단위 (용량 계산용)
}

export class CreateSessionDto {
  @IsDateString()
  sessionAt!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  lessonUuid!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMediaFileDto)
  @IsOptional()
  newMediaFiles?: CreateMediaFileDto[]; // 새로 업로드한 파일들 (temp URL)

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  existingMediaFileUuids?: string[]; // 기존 파일 재활용 (uuid 목록)
}
