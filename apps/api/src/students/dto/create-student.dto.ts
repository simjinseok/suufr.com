import { IsString, IsOptional, IsEmail, IsDateString } from 'class-validator';

export class CreateStudentDto {
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
