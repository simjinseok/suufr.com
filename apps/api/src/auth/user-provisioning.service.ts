import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Apple '나의 이메일 가리기' 주소는 앞부분이 무작위 문자열이라 조직·프로필 이름으로 쓰지 않는다.
 * 이름도 없으면 이 기본값으로 시작하고, 사용자가 설정에서 바꾼다.
 */
export const APPLE_PRIVATE_RELAY_SUFFIX = '@privaterelay.appleid.com';
export const DEFAULT_ORGANIZATION_NAME = '내 스튜디오';

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

    const orgName = name?.trim()
      || (email.toLowerCase().endsWith(APPLE_PRIVATE_RELAY_SUFFIX) ? DEFAULT_ORGANIZATION_NAME : email.split('@')[0]);
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
