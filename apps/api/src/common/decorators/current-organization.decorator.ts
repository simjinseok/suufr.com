import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Organization, OrganizationMember } from '@prisma/generated/client';

export interface CurrentOrganizationData {
  organization: Organization;
  member: OrganizationMember;
}

export const CurrentOrganization = createParamDecorator(
  (data: 'organization' | 'member' | undefined, ctx: ExecutionContext): CurrentOrganizationData | Organization | OrganizationMember | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const orgData = request.organization as CurrentOrganizationData;

    if (!orgData) {
      return undefined;
    }

    if (data === 'organization') {
      return orgData.organization;
    }
    if (data === 'member') {
      return orgData.member;
    }

    return orgData;
  },
);
