import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { MemberStatusValue } from '@prisma/generated/client';

export class UpdateMemberStatusDto {
  @IsEnum(MemberStatusValue)
  @IsOptional()
  status?: MemberStatusValue;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  changedAt?: string;
}
