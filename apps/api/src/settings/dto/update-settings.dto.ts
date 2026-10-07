import { IsBoolean, IsOptional, IsInt, IsIn, IsTimeZone, Min, ValidateIf } from 'class-validator';
import { PAYMENT_METHODS, type PaymentMethod } from '../payment-methods';

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

  // 새 입금 폼의 초기 선택값. @IsOptional 은 null 도 통과시키는데 컬럼이 NOT NULL 이라
  // "생략"만 허용하고 null 은 @IsIn 으로 거부한다.
  @ValidateIf((o: UpdateSettingsDto) => o.defaultPaymentMethod !== undefined)
  @IsIn(PAYMENT_METHODS)
  defaultPaymentMethod?: PaymentMethod;
}
