import { IsString, IsOptional, IsDateString, IsInt, Min, IsBoolean } from 'class-validator';

export class UpdateSessionDto {
  @IsDateString()
  @IsOptional()
  sessionAt?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isDone?: boolean;
}
