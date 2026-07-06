import { IsString, IsUUID } from 'class-validator';

export class OrganizationTargetDto {
  @IsUUID()
  organizationUuid!: string;
}

export class ActivateBillingDto extends OrganizationTargetDto {
  @IsString()
  authKey!: string;
}
