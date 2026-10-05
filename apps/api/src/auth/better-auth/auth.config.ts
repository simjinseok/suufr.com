import { randomUUID } from 'node:crypto';
import type { BetterAuthOptions } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer, emailOTP, jwt, twoFactor } from 'better-auth/plugins';
import type { PrismaClient } from '@prisma/generated/client';
import type { MailService } from '../../mail/mail.service';
import { existingUserSignupAttemptMail, resetPasswordMail, verifyEmailMail } from '../../mail/templates/auth-mails';
import {
  BETTER_AUTH_BASE_PATH,
  JWT_TTL_SECONDS,
  OTP_LENGTH,
  OTP_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
} from './auth.constants';

export type AuthConfigDeps = {
  prisma: PrismaClient;
  /** api 공개 URL. JWT iss/aud 이자 better-auth baseURL. */
  baseURL: string;
  secret: string;
  webUrl: string;
  mail: MailService;
  /** users 행 생성 직후(가입) — Organization/UserSettings 부트스트랩 */
  onUserCreated: (user: { id: string; email: string; name: string }) => Promise<void>;
};

/**
 * better-auth 옵션. 모델명만 지정하고 컬럼 매핑은 Prisma @map 에 맡긴다(어댑터는 Prisma Client 모델 API 를 쓴다).
 * 반환 타입을 넓히지 않아야(satisfies) auth.api 에 플러그인 엔드포인트 타입이 추론된다.
 */
export function createAuthOptions(deps: AuthConfigDeps) {
  const { prisma, baseURL, secret, webUrl, mail } = deps;

  return {
    appName: '스프',
    baseURL,
    basePath: BETTER_AUTH_BASE_PATH,
    secret,
    trustedOrigins: [webUrl],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),

    emailAndPassword: {
      enabled: true,
      // 가입 후 OTP 인증 전까지 로그인 불가. 중복 이메일 가입은 열거 방지를 위해 200(합성 사용자)으로 응답된다.
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      onExistingUserSignUp: async ({ user }) => {
        void mail.send(existingUserSignupAttemptMail(user.email));
      },
      // 플러그인(twoFactor)과 additionalFields 가 user 에 컬럼을 더하므로 합성 응답도 같은 모양이어야 한다
      customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
        ...coreFields,
        twoFactorEnabled: false,
        ...additionalFields,
        id,
      }),
    },
    emailVerification: {
      autoSignInAfterVerification: false,
    },

    user: {
      modelName: 'user',
      additionalFields: {
        cognitoMigratedAt: { type: 'date', required: false, input: false, returned: false },
        cognitoMfaEnabled: { type: 'boolean', required: false, input: false, returned: false, defaultValue: false },
        requiresTwoFactorSetup: { type: 'boolean', required: false, input: false, defaultValue: false },
      },
    },
    // 기존 수업 모델 Session(prisma.session) 과 충돌 → prisma.authSession
    session: {
      modelName: 'authSession',
      expiresIn: SESSION_TTL_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },
    account: { modelName: 'account' },
    verification: { modelName: 'verification' },

    plugins: [
      jwt({
        jwt: {
          expirationTime: `${JWT_TTL_SECONDS}s`,
          issuer: baseURL,
          audience: baseURL,
          // sub 는 기본값(user.id = Cognito sub). 가드가 쓰는 최소 클레임만 싣는다
          definePayload: ({ user }) => ({ email: user.email, name: user.name, emailVerified: user.emailVerified }),
        },
      }),
      // Authorization: Bearer <세션 토큰> 을 세션 쿠키처럼 취급 (/token, /sign-out, 2FA 관리에 사용)
      bearer(),
      twoFactor({ issuer: '스프' }),
      emailOTP({
        otpLength: OTP_LENGTH,
        expiresIn: OTP_TTL_SECONDS,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        // 링크 대신 OTP 로 이메일 인증 (기존 6자리 코드 UX 유지). 이때 sendVerificationOnSignUp 은 무시되고 코어 sign-up 이 발송한다
        overrideDefaultEmailVerification: true,
        async sendVerificationOTP({ email, otp, type }) {
          // 타이밍 공격 방지: 발송을 기다리지 않는다
          if (type === 'forget-password') void mail.send(resetPasswordMail(email, otp));
          else void mail.send(verifyEmailMail(email, otp));
        },
      }),
    ],
    // OTP 단독 로그인(비밀번호 우회)은 제공하지 않는다
    disabledPaths: ['/sign-in/email-otp'],

    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await deps.onUserCreated({ id: user.id, email: user.email, name: user.name });
          },
        },
      },
    },
    advanced: {
      // users.id 는 @db.Uuid — 기본 base62 id 대신 uuid v4 (기존 사용자 행은 Cognito 이전 당시 sub 로 생성됨)
      database: { generateId: () => randomUUID() },
      // web 서버→api 서버 호출이므로 쿠키 보안 속성은 의미 없음. 실제 쿠키는 web 이 자체 설정한다
      useSecureCookies: process.env.NODE_ENV === 'production',
    },
    // 레이트리밋은 NestJS Throttler(AuthController)가 담당. auth.api 서버 호출은 어차피 대상이 아니다
    rateLimit: { enabled: false },
  } satisfies BetterAuthOptions;
}
