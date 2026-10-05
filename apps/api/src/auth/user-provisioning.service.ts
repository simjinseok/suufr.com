import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 사용자 최초 진입 시 필요한 행(users, organizations, user_settings)을 보장한다.
 * Cognito 로그인(이전 기간)과 better-auth 가입(databaseHooks.user.create.after) 양쪽에서 호출된다.
 * users.id 는 항상 인증 제공자의 사용자 식별자(Cognito sub = better-auth user.id)다.
 */
@Injectable()
export class UserProvisioningService {
  constructor(private readonly prisma: PrismaService) {}

  /** users 행 보장. 이미 있으면 건드리지 않는다(이름·이메일은 사용자가 바꿀 수 있음). */
  async ensureUser(params: { id: string; email: string; name?: string | null; emailVerified: boolean }) {
    const email = params.email.trim().toLowerCase();
    await this.prisma.user.upsert({
      where: { id: params.id },
      create: {
        id: params.id,
        email,
        name: params.name?.trim() || email.split('@')[0],
        emailVerified: params.emailVerified,
      },
      update: {},
    });
  }

  /** 첫 로그인 시 Organization + UserSettings 생성 (기존 CognitoService.ensureUserWithOrganization 이동). */
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
