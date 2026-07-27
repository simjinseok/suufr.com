import { IsString, IsOptional, IsDateString, IsInt, IsArray, IsUUID, NotEquals } from 'class-validator';

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

  // set 의미론: undefined = 연결 불변, [] = 전부 해제 (§6-22)
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  invoiceUuids?: string[];
}
