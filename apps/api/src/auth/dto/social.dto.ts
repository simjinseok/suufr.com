import { IsString, MaxLength } from 'class-validator';

export class SocialExchangeDto {
  @IsString()
  @MaxLength(128)
  code!: string;
}
