import { IsString, IsOptional, IsEmail, IsDateString, IsUUID, IsEnum } from 'class-validator';
import { StudentStatusValue } from '@prisma/generated/client';

export class CreateStudentDto {
  @IsUUID()
  organizationUuid!: string;

  @IsString()
  name!: string;

  @IsEnum(StudentStatusValue)
  @IsOptional()
  status?: StudentStatusValue;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsDateString()
  @IsOptional()
  nextPaymentAt?: string;
}
