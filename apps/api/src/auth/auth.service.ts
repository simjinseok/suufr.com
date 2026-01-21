import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './guards/jwt-auth.guard';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async getUserSettings(userId: string) {
    return this.prisma.userSettings.findUnique({
      where: { userId },
    });
  }

  async getOrCreateUserSettings(userId: string) {
    const existing = await this.getUserSettings(userId);
    if (existing) {
      return existing;
    }

    return this.prisma.userSettings.create({
      data: { userId },
    });
  }

  async getCurrentOrganization(user: AuthenticatedUser) {
    const settings = await this.getOrCreateUserSettings(user.userId);

    if (settings.currentOrganizationId) {
      const member = await this.prisma.organizationMember.findFirst({
        where: {
          organizationId: settings.currentOrganizationId,
          userId: user.userId,
          deletedAt: null,
        },
        include: {
          organization: true,
        },
      });

      if (member && !member.organization.deletedAt) {
        return {
          organization: member.organization,
          member,
        };
      }
    }

    // No current organization set or invalid - find first available
    const firstMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId: user.userId,
        deletedAt: null,
        organization: {
          deletedAt: null,
        },
      },
      include: {
        organization: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (firstMember) {
      // Update current organization
      await this.prisma.userSettings.update({
        where: { userId: user.userId },
        data: { currentOrganizationId: firstMember.organizationId },
      });

      return {
        organization: firstMember.organization,
        member: firstMember,
      };
    }

    return null;
  }

  async getUserOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        deletedAt: null,
        organization: { deletedAt: null },
      },
      include: {
        organization: true,
      },
    });

    return memberships.map(m => ({
      id: m.organization.id,
      uuid: m.organization.uuid,
      name: m.organization.name,
      role: m.role,
      membershipId: m.id,
      membershipUuid: m.uuid,
      membershipName: m.name,
      profileImageKey: m.profileImageKey,
    }));
  }
}
