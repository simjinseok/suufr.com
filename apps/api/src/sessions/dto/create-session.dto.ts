import { IsString, IsOptional, IsUUID, IsDateString, IsInt, Min, IsArray } from 'class-validator';

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
  @IsUUID('all', { each: true })
  @IsOptional()
  mediaFileUuids?: string[]; // 첨부할 파일 UUID 목록
}
