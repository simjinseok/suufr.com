import { IsString, IsOptional, IsUUID, MinLength } from 'class-validator';

export class CreateCurriculumSectionDto {
  @IsUUID()
  curriculumUuid!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
