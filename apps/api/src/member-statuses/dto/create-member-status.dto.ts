import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { MemberStatusValue } from '@prisma/generated/client';

export class CreateMemberStatusDto {
  @IsEnum(MemberStatusValue)
  status!: MemberStatusValue;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  changedAt?: string;
}
