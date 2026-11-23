import { IsEnum } from 'class-validator';
import { SessionStatusValue } from '@prisma/generated/client';

export class UpdateSessionStatusDto {
  @IsEnum(SessionStatusValue)
  status!: SessionStatusValue;
}
