import { IsBoolean, IsOptional, IsInt, IsTimeZone, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsBoolean()
  @IsOptional()
  use24HourFormat?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  defaultDuration?: number;

  @IsBoolean()
  @IsOptional()
  autoUpdateNextPaymentAt?: boolean;

  @IsTimeZone()
  @IsOptional()
  timezone?: string;
}
