import { IsString, IsOptional, IsEnum } from 'class-validator';
import { OrganizationRole } from '@prisma/generated/client';

export class CreateMemberDto {
  @IsString()
  name!: string;

  @IsEnum(OrganizationRole)
  @IsOptional()
  role?: OrganizationRole;
}
