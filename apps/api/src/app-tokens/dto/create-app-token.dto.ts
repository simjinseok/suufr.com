import { IsString } from 'class-validator';

export class CreateAppTokenDto {
  @IsString()
  name!: string;
}
