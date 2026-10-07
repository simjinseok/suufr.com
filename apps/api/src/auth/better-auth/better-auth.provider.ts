import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { UserProvisioningService } from '../user-provisioning.service';
import { createAuthOptions, type AuthConfigDeps } from './auth.config';
import { BETTER_AUTH } from './auth.constants';

export function createAuth(deps: AuthConfigDeps) {
  return betterAuth(createAuthOptions(deps));
}

export type Auth = ReturnType<typeof createAuth>;

function requireEnv(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  if (!value) throw new Error(`${key} 환경변수가 필요합니다`);
  return value;
}

/** betterAuth 인스턴스를 Nest DI 로 1회 생성. 주입 토큰: BETTER_AUTH */
export const betterAuthProvider: Provider = {
  provide: BETTER_AUTH,
  inject: [ConfigService, PrismaService, MailService, UserProvisioningService],
  useFactory: (
    config: ConfigService,
    prisma: PrismaService,
    mail: MailService,
    provisioning: UserProvisioningService,
  ): Auth => {
    const googleClientId = config.get<string>('GOOGLE_CLIENT_ID');
    const googleClientSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
    const googleIdTokenAudiences = (config.get<string>('GOOGLE_ID_TOKEN_AUDIENCES') ?? '')
      .split(',').map(s => s.trim()).filter(Boolean);
    return createAuth({
      prisma,
      baseURL: requireEnv(config, 'BETTER_AUTH_URL'),
      secret: requireEnv(config, 'BETTER_AUTH_SECRET'),
      webUrl: config.get<string>('WEB_URL') || 'http://localhost:3000',
      mail,
      onUserCreated: user => provisioning.ensureOrganization(user.id, user.email, user.name),
      google: googleClientId && googleClientSecret
        ? { clientId: googleClientId, clientSecret: googleClientSecret, idTokenAudiences: googleIdTokenAudiences }
        : undefined,
    });
  },
};
