import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { PrismaClient } from '@prisma/generated/client';
import type { CognitoMigrationService } from '../cognito-migration.service';

export const COGNITO_ERROR_CODES = {
  /** 임시 비밀번호 계정 — Cognito NEW_PASSWORD_REQUIRED. body.session 에 Cognito 세션 */
  NEW_PASSWORD_REQUIRED: 'COGNITO_NEW_PASSWORD_REQUIRED',
  /** Cognito 가입 후 이메일 미인증 */
  USER_NOT_CONFIRMED: 'COGNITO_USER_NOT_CONFIRMED',
} as const;

/**
 * /sign-in/email 직전에 실행되는 lazy migration (Phase 4).
 *
 * credential 계정(= better-auth 비밀번호)이 없는 사용자는 Cognito 로 비밀번호를 검증하고,
 * 성공하면 같은 비밀번호의 scrypt 해시를 accounts 에 기록한 뒤 better-auth 가 정상 경로로 검증을 이어간다.
 * users 행이 없는 사용자(export 이후 Cognito 가입, 미로그인)도 Cognito 토큰 클레임(sub, email, name)으로 행을 만든다.
 *
 * options.hooks.before 는 플러그인 훅(2FA, bearer)보다 먼저 실행된다(better-auth dispatch 순서).
 */
export function createCognitoMigrationHook(deps: { prisma: PrismaClient; migration: CognitoMigrationService }) {
  return createAuthMiddleware(async (ctx) => {
    if (ctx.path !== '/sign-in/email') return;

    const body = ctx.body as { email?: string; password?: string } | undefined;
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;
    if (!email || !password) return;

    const user = await deps.prisma.user.findUnique({
      where: { email },
      select: { id: true, accounts: { where: { providerId: 'credential' }, select: { id: true } } },
    });
    // 이미 이전된 사용자 → better-auth 가 검증
    if (user && user.accounts.length > 0) return;

    const outcome = await deps.migration.verifyWithCognito(email, password);

    switch (outcome.kind) {
      case 'authenticated':
      case 'mfa-required':
        // 비밀번호가 맞다 (MFA 챌린지도 비밀번호 검증 뒤에 온다). 해시를 기록하고 정상 경로로 진행
        await deps.migration.migrateCredential({
          // 백필된 users 행이 있으면 그 id 가 확정된 sub. MFA 챌린지 응답의 USER_ID_FOR_SRP 는 보조
          sub: user?.id ?? outcome.sub,
          email,
          name: outcome.name,
          password,
          cognitoMfaEnabled: outcome.kind === 'mfa-required',
        });
        return;
      case 'new-password-required':
        throw new APIError('BAD_REQUEST', {
          code: COGNITO_ERROR_CODES.NEW_PASSWORD_REQUIRED,
          message: '새 비밀번호 설정이 필요합니다',
          session: outcome.session,
        });
      case 'not-confirmed':
        throw new APIError('BAD_REQUEST', {
          code: COGNITO_ERROR_CODES.USER_NOT_CONFIRMED,
          message: '이메일 인증이 필요합니다',
        });
      case 'not-authorized':
      case 'not-found':
      case 'unavailable':
        // better-auth 가 평소처럼 실패시킨다 (INVALID_EMAIL_OR_PASSWORD / CREDENTIAL_ACCOUNT_NOT_FOUND → 같은 한국어 메시지)
        return;
    }
  });
}
