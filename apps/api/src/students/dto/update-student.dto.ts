import { IsString, IsOptional, IsEmail, IsDateString, Allow, IsUrl } from 'class-validator';

export class UpdateStudentDto {
  @IsString()
  @IsOptional()
  name?: string;

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

  @Allow()
  @IsOptional()
  profileImageUrl?: string | null;
}
