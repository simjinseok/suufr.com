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
    const organization = await this.prisma.organization.findFirst({
      where: {
        userId: user.userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (organization) {
      return { organization };
    }

    return null;
  }

  async getUserOrganizations(userId: string) {
    const organizations = await this.prisma.organization.findMany({
      where: {
        userId,
        deletedAt: null,
      },
    });

    return organizations.map(o => ({
      id: o.id,
      uuid: o.uuid,
      name: o.name,
      profileName: o.profileName,
      profileImageUrl: o.profileImageUrl,
    }));
  }
}
