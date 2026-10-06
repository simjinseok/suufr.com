import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 사용자 최초 진입 시 필요한 행(organizations, user_settings)을 보장한다.
 * better-auth 가입(databaseHooks.user.create.after) 에서 호출된다. users.id 는 better-auth user.id 다 (유래는 schema.prisma User 참고).
 */
@Injectable()
export class UserProvisioningService {
  constructor(private readonly prisma: PrismaService) {}

  /** 첫 진입 시 Organization + UserSettings 생성. */
  async ensureOrganization(userId: string, email: string, name?: string | null) {
    const existing = await this.prisma.organization.findFirst({ where: { userId } });
    if (existing) return;

    const orgName = name?.trim() || email.split('@')[0];
    await this.prisma.$transaction(async (tx) => {
      await tx.organization.create({
        data: { name: orgName, userId, profileName: orgName },
      });
      await tx.userSettings.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
    });
  }
}
