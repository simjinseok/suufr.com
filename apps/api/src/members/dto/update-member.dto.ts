import { IsString, IsOptional, IsEnum } from 'class-validator';
import { OrganizationRole } from '@prisma/generated/client';

export class UpdateMemberDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(OrganizationRole)
  @IsOptional()
  role?: OrganizationRole;
}
