import { IsString, IsOptional, IsDateString, IsInt, Min } from 'class-validator';

export class UpdatePaymentDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  paidAt?: string;
}
