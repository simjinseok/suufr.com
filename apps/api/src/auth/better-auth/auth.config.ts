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
import { recordOtpMailFailure } from './otp-mail-failure';

export type AuthConfigDeps = {
  prisma: PrismaClient;
  /** api 공개 URL. JWT iss/aud 이자 better-auth baseURL. */
  baseURL: string;
  secret: string;
  webUrl: string;
  mail: MailService;
  /** users 행 생성 직후(가입) — Organization/UserSettings 부트스트랩 */
  onUserCreated: (user: { id: string; email: string; name: string }) => Promise<void>;
  /**
   * Google 로그인. 캘린더 연동과 같은 OAuth 클라이언트를 쓴다. 둘 다 없으면 소셜 로그인 비활성.
   * idTokenAudiences: iOS 네이티브 로그인의 ID 토큰 audience 로 추가 허용할 클라이언트 ID (예: 로컬 api 가 운영 서버 클라이언트 ID 토큰을 받을 때)
   */
  google?: { clientId: string; clientSecret: string; idTokenAudiences?: string[] };
};

/**
 * better-auth 옵션. 모델명만 지정하고 컬럼 매핑은 Prisma @map 에 맡긴다(어댑터는 Prisma Client 모델 API 를 쓴다).
 * 반환 타입을 넓히지 않아야(satisfies) auth.api 에 플러그인 엔드포인트 타입이 추론된다.
 */
export function createAuthOptions(deps: AuthConfigDeps) {
  const { prisma, baseURL, secret, webUrl, mail, google } = deps;

  return {
    appName: '스프',
    baseURL,
    // HTTP 핸들러는 마운트하지 않는다 — web 은 AuthController(/auth/*)만 호출하고, 여기서는 auth.api.* 를 직접 쓴다.
    // basePath 는 쿠키·JWT 발급 등 내부 경로 계산에만 쓰인다
    basePath: BETTER_AUTH_BASE_PATH,
    secret,
    trustedOrigins: [webUrl],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),

    // Google 콘솔에 등록하는 리디렉션 URI: <baseURL>/auth/google/callback (SocialLoginController 가 받아 넘긴다)
    ...(google
      ? {
          socialProviders: {
            google: {
              // 배열이면 첫 번째가 OAuth(인증 URL·코드 교환)에 쓰이고, 전체가 ID 토큰 audience 검증에 쓰인다 (better-auth google provider)
              clientId: google.idTokenAudiences?.length ? [google.clientId, ...google.idTokenAudiences] : google.clientId,
              clientSecret: google.clientSecret,
              redirectURI: `${baseURL}/auth/google/callback`,
              prompt: 'select_account',
            },
          },
        }
      : {}),

    emailAndPassword: {
      enabled: true,
      // 이메일 인증은 나중에 해도 된다 — 미인증 계정도 로그인되고, 인증 전까지 web 이 배너로 안내한다.
      // autoSignIn 은 끈다: better-auth 는 requireEmailVerification 이나 autoSignIn:false 일 때만 중복 이메일을
      // 열거 방지용 200(합성 사용자)으로 응답한다. 가입 직후 로그인은 AuthController.signup 이 signIn 으로 처리한다
      requireEmailVerification: false,
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
      // requireEmailVerification 이 꺼져도 가입 시 인증코드(OTP) 메일은 보낸다
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
    },

    user: { modelName: 'user' },
    // 기존 수업 모델 Session(prisma.session) 과 충돌 → prisma.authSession
    session: {
      modelName: 'authSession',
      expiresIn: SESSION_TTL_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },
    account: {
      modelName: 'account',
      // 같은 이메일의 기존 사용자(비밀번호 계정)에 Google 계정을 자동 연결 — users.id 가 유지된다.
      // better-auth 는 기존 사용자의 emailVerified 가 true 일 때만 연결한다
      accountLinking: { enabled: true, trustedProviders: ['google'] },
    },
    verification: { modelName: 'verification' },

    plugins: [
      jwt({
        jwt: {
          expirationTime: `${JWT_TTL_SECONDS}s`,
          issuer: baseURL,
          audience: baseURL,
          // sub 는 기본값(user.id). 가드가 쓰는 최소 클레임만 싣는다
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
          // 사용자가 이 메일을 기다리므로 발송 결과를 기다리고, 실패는 MailDeliveryError → 503 으로 사용자에게 알린다.
          // (응답 시간으로 가입 여부를 추정할 여지는 생기지만, 발송 실패를 숨겨 사용자를 기다리게 하는 것보다 낫다)
          // better-auth 는 여기서 던진 에러를 잡아 성공으로 응답하므로, 기록해 두고 BetterAuthService.run 이 다시 던진다
          try {
            if (type === 'forget-password') await mail.sendOrThrow(resetPasswordMail(email, otp));
            else await mail.sendOrThrow(verifyEmailMail(email, otp));
          }
          catch (error) {
            recordOtpMailFailure(error);
            throw error;
          }
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
      // users.id 는 @db.Uuid — 기본 base62 id 대신 uuid v4 (기존 행의 유래는 schema.prisma User 참고)
      database: { generateId: () => randomUUID() },
      // web 서버→api 서버 호출이므로 쿠키 보안 속성은 의미 없음. 실제 쿠키는 web 이 자체 설정한다
      useSecureCookies: process.env.NODE_ENV === 'production',
    },
    // 레이트리밋은 NestJS Throttler(AuthController)가 담당 (핸들러 미마운트라 better-auth 자체 제한은 쓰이지 않는다)
    rateLimit: { enabled: false },
  } satisfies BetterAuthOptions;
}
