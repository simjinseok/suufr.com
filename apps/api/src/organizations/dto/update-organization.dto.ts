import { IsString, IsOptional, Allow } from 'class-validator';

export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  profileName?: string;

  @Allow()
  @IsOptional()
  profileImageUrl?: string | null;

  @Allow()
  @IsOptional()
  logoImageUrl?: string | null;
}
