import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { StudentStatusValue } from '@prisma/generated/client';

export class UpdateStudentStatusDto {
  @IsEnum(StudentStatusValue)
  @IsOptional()
  status?: StudentStatusValue;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  changedAt?: string;
}
