import { IsString, IsOptional, IsDateString, IsInt, NotEquals } from 'class-validator';

export class UpdatePaymentDto {
  @IsInt()
  @NotEquals(0)
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  method?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  paidAt?: string;
}
