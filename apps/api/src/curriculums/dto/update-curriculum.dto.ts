import { IsString, IsOptional } from 'class-validator';

export class UpdateCurriculumDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
