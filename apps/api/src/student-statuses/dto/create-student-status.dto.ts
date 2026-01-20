import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { StudentStatusValue } from '@prisma/generated/client';

export class CreateStudentStatusDto {
  @IsEnum(StudentStatusValue)
  status!: StudentStatusValue;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  changedAt?: string;
}
