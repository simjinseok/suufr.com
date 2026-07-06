import { IsString } from 'class-validator';

export class ActivateBillingDto {
  @IsString()
  authKey!: string;
}
