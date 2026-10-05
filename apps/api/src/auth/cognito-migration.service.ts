import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CognitoService, type CognitoAuthOutcome } from './cognito.service';
import { UserProvisioningService } from './user-provisioning.service';

export const CREDENTIAL_PROVIDER_ID = 'credential';

/**
 * Cognito → better-auth 비밀번호 lazy migration.
 * - verifyWithCognito: 비밀번호를 Cognito 로 검증만 한다 (세션 발급·Organization 생성 없음)
 * - migrateCredential: users 행 보장 + accounts(credential) 에 scrypt 해시 기록
 *
 * hashPassword 는 better-auth 기본 해시(scrypt)와 동일하므로 이후 better-auth 가 그대로 검증할 수 있다.
 * Phase 6(Cognito 제거)에서 이 서비스와 훅을 함께 지운다.
 */
@Injectable()
export class CognitoMigrationService {
  private readonly logger = new Logger(CognitoMigrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cognito: CognitoService,
    private readonly provisioning: UserProvisioningService,
  ) {}

  async verifyWithCognito(email: string, password: string): Promise<CognitoAuthOutcome> {
    try {
      return await this.cognito.authenticate(email, password);
    }
    catch (error) {
      // Cognito 장애·네트워크 오류: 이전을 미루고 better-auth 의 일반 실패로 흘린다
      this.logger.error(`Cognito 검증 실패 (email=${email})`, error instanceof Error ? error.stack : String(error));
      return { kind: 'unavailable' };
    }
  }

  async hasCredentialAccount(email: string): Promise<boolean> {
    const count = await this.prisma.account.count({
      where: { providerId: CREDENTIAL_PROVIDER_ID, user: { email: email.trim().toLowerCase() } },
    });
    return count > 0;
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  }

  /**
   * 검증된 비밀번호를 better-auth 에 기록한다. 멱등: 이미 credential 계정이 있으면 해시만 갱신.
   * Cognito MFA 사용자는 requiresTwoFactorSetup 을 켜서 web 이 재등록을 안내한다.
   */
  async migrateCredential(params: {
    sub: string;
    email: string;
    name?: string | null;
    password: string;
    cognitoMfaEnabled: boolean;
  }) {
    const email = params.email.trim().toLowerCase();
    const hash = await hashPassword(params.password);

    await this.provisioning.ensureUser({ id: params.sub, email, name: params.name, emailVerified: true });

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.account.findFirst({
        where: { userId: params.sub, providerId: CREDENTIAL_PROVIDER_ID },
        select: { id: true },
      });
      if (existing) {
        await tx.account.update({ where: { id: existing.id }, data: { password: hash } });
      }
      else {
        await tx.account.create({
          data: {
            id: randomUUID(),
            userId: params.sub,
            accountId: params.sub,
            providerId: CREDENTIAL_PROVIDER_ID,
            password: hash,
          },
        });
      }
      await tx.user.update({
        where: { id: params.sub },
        data: {
          emailVerified: true,
          cognitoMigratedAt: new Date(),
          ...(params.cognitoMfaEnabled ? { cognitoMfaEnabled: true, requiresTwoFactorSetup: true } : {}),
        },
      });
    });

    // 조직은 보통 이미 있다(첫 로그인 시 생성). 가입 후 미로그인 사용자는 여기서 생성된다
    await this.provisioning.ensureOrganization(params.sub, email, params.name);
    this.logger.log(`Cognito → better-auth 비밀번호 이전 완료 (userId=${params.sub})`);
  }
}
