import { IsString, IsOptional, IsUUID, IsDateString, IsInt, Min } from 'class-validator';

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
}
