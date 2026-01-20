import { IsString, IsOptional, IsUUID, IsDateString, IsInt, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @Min(0)
  amount!: number;

  @IsString()
  paymentMethod!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  paidAt!: string;

  @IsUUID()
  lessonUuid!: string;
}
