import { IsString, IsOptional } from 'class-validator';

export class CreateCurriculumDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
