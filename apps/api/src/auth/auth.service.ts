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

  /**
   * /me 의 user 에 실리는 보안 상태.
   * hasPassword: credential 계정에 비밀번호가 있으면 true — 클라이언트가 계정 삭제 재인증 방식(비밀번호 / 이메일 코드)을 고른다
   */
  async getSecurityStatus(userId: string): Promise<{ twoFactorEnabled: boolean; emailVerified: boolean; hasPassword: boolean }> {
    const [user, credential] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true, emailVerified: true },
      }),
      this.prisma.account.findFirst({
        where: { userId, providerId: 'credential', password: { not: null } },
        select: { id: true },
      }),
    ]);
    return {
      twoFactorEnabled: user?.twoFactorEnabled ?? false,
      emailVerified: user?.emailVerified ?? false,
      hasPassword: credential !== null,
    };
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
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
