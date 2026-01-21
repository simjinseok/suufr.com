import { IsString, IsOptional, IsEmail, IsDateString, IsUUID } from 'class-validator';

export class CreateStudentDto {
  @IsUUID()
  organizationUuid!: string;

  @IsString()
  name!: string;

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
