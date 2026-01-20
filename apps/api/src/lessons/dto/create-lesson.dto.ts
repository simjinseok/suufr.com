import { IsString, IsOptional, IsUUID, IsArray, ValidateNested, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

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
}

export class CreateLessonDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  studentUuid!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSessionDto)
  @IsOptional()
  sessions?: CreateSessionDto[];
}
