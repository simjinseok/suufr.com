import type { Provider } from '@nestjs/common';
import { Logger } from '@nestjs/common';
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

function parseCsv(value: string | undefined): string[] {
  return (value ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

/** APPLE_APP_BUNDLE_ID 가 없으면 undefined(Apple 로그인 비활성) */
export function readAppleSignInConfig(config: ConfigService): AuthConfigDeps['apple'] {
  const bundleId = config.get<string>('APPLE_APP_BUNDLE_ID');
  if (!bundleId) return undefined;
  return { bundleId, idTokenAudiences: parseCsv(config.get<string>('APPLE_ID_TOKEN_AUDIENCES')) };
}

/** Apple 로그인은 켜져 있는데 revoke 용 키(APPLE_TEAM_ID·APPLE_KEY_ID·APPLE_PRIVATE_KEY) 중 하나라도 없으면 true (기동 시 경고 판정) */
export function appleRevokeKeysMissing(config: ConfigService): boolean {
  if (!readAppleSignInConfig(config)) return false;
  return !['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'].every(key => config.get<string>(key));
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
    const googleIdTokenAudiences = parseCsv(config.get<string>('GOOGLE_ID_TOKEN_AUDIENCES'));
    const apple = readAppleSignInConfig(config);
    if (appleRevokeKeysMissing(config)) {
      new Logger('BetterAuth').warn('APPLE_TEAM_ID·APPLE_KEY_ID·APPLE_PRIVATE_KEY 가 없어 Apple refresh token(탈퇴 시 revoke 용)을 저장하지 않습니다');
    }
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
      apple,
    });
  },
};
