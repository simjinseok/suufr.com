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
import { EMAIL_LINKED_SOCIAL_PROVIDERS, revokePasswordOnUnverifiedSocialLink } from './social-link-policy';

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
  /**
   * Sign in with Apple (iOS 네이티브 identity token 전용). 없으면 Apple 로그인 비활성.
   * bundleId: 운영 앱 번들 ID(APPLE_APP_BUNDLE_ID). idTokenAudiences: 추가로 받을 번들 ID(APPLE_ID_TOKEN_AUDIENCES, 예: 로컬의 com.suufr.ios.dev)
   */
  apple?: { bundleId: string; idTokenAudiences?: string[] };
};

/**
 * better-auth 옵션. 모델명만 지정하고 컬럼 매핑은 Prisma @map 에 맡긴다(어댑터는 Prisma Client 모델 API 를 쓴다).
 * 반환 타입을 넓히지 않아야(satisfies) auth.api 에 플러그인 엔드포인트 타입이 추론된다.
 */
export function createAuthOptions(deps: AuthConfigDeps) {
  const { prisma, baseURL, secret, webUrl, mail, google, apple } = deps;

  return {
    appName: '스프',
    baseURL,
    // HTTP 핸들러는 마운트하지 않는다 — web 은 AuthController(/auth/*)만 호출하고, 여기서는 auth.api.* 를 직접 쓴다.
    // basePath 는 쿠키·JWT 발급 등 내부 경로 계산에만 쓰인다
    basePath: BETTER_AUTH_BASE_PATH,
    secret,
    trustedOrigins: [webUrl],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),

    socialProviders: {
      // Google 콘솔에 등록하는 리디렉션 URI: <baseURL>/auth/google/callback (SocialLoginController 가 받아 넘긴다)
      ...(google
        ? {
            google: {
              // 배열이면 첫 번째가 OAuth(인증 URL·코드 교환)에 쓰이고, 전체가 ID 토큰 audience 검증에 쓰인다 (better-auth google provider)
              clientId: google.idTokenAudiences?.length ? [google.clientId, ...google.idTokenAudiences] : google.clientId,
              clientSecret: google.clientSecret,
              redirectURI: `${baseURL}/auth/google/callback`,
              prompt: 'select_account',
            },
          }
        : {}),
      // 네이티브 identity token 로그인만 쓴다. 브라우저 OAuth(인증 URL·코드 교환)는 열지 않으므로(SUPPORTED_SOCIAL_PROVIDERS 에 없음)
      // clientSecret 은 비운다. revoke 용 refresh token 교환은 AppleTokenService 가 요청마다 만든 client secret 으로 직접 한다
      ...(apple
        ? {
            apple: {
              clientId: apple.bundleId,
              clientSecret: '',
              appBundleIdentifier: apple.bundleId,
              audience: [...new Set([apple.bundleId, ...(apple.idTokenAudiences ?? [])])],
            },
          }
        : {}),
    },

    emailAndPassword: {
      enabled: true,
      // 이메일을 인증하기 전에는 비밀번호로 로그인할 수 없다(남의 이메일로 미리 가입해 두는 계정 탈취 방지).
      // 비밀번호가 맞으면 403 EMAIL_NOT_VERIFIED 로 거부하고 인증코드 메일을 보낸다(emailVerification.sendOnSignIn).
      // 비밀번호가 틀리면 인증 여부와 관계없이 일반 실패(401)다 — better-auth 가 비밀번호를 먼저 확인한다.
      // 이 설정은 이메일·비밀번호 로그인에만 걸린다. Google 로그인·refresh 에는 영향이 없다.
      // 가입 직후에도 세션은 없다. 인증코드를 확인하면 AuthController.verifyEmail 이 로그인 토큰을 준다
      requireEmailVerification: true,
      autoSignIn: false,
      // 진짜 소유자가 비밀번호 재설정으로 계정을 되찾을 때 이전 세션이 살아남지 않도록 재설정 시 모든 세션을 폐기한다
      revokeSessionsOnPasswordReset: true,
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
      // 가입 시, 그리고 미인증 계정이 맞는 비밀번호로 로그인할 때 인증코드(OTP) 메일을 보낸다
      sendOnSignUp: true,
      sendOnSignIn: true,
      // 인증 직후 로그인은 BetterAuthService.verifyEmail 이 조건(미인증이었고 2단계 인증이 꺼진 계정)을 보고 직접 한다
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
      // 소셜 provider 토큰(accounts.access_token·refresh_token)을 BETTER_AUTH_SECRET 파생 키로 암호화해 저장한다 (Apple revoke 용 refresh token).
      // 앱 코드는 이 컬럼을 읽지 않는다(캘린더 연동 토큰은 external_service_tokens). 켜기 전 평문 행은 그대로 남는다.
      // BETTER_AUTH_SECRET 을 바꾸면 저장된 토큰은 복호화할 수 없다
      encryptOAuthTokens: true,
      // 같은 이메일의 기존 사용자에 Google·Apple 계정을 자동 연결한다 — users.id 가 유지된다.
      // 기존 사용자의 인증 여부와 관계없이 연결하고(기본값 requireLocalEmailVerified: true 면 미인증 사용자 연결을 거부한다),
      // 미인증 사용자였다면 연결 순간 비밀번호 계정을 지우고 기존 세션을 폐기한다(databaseHooks.account, social-link-policy.ts).
      // 인증된 사용자는 비밀번호 로그인·기존 세션을 그대로 둔다. provider 쪽 email_verified 가 true 면 better-auth 가 emailVerified 를 true 로 바꾼다.
      // Apple 은 email_verified 가 항상 true 라 trustedProviders 여부와 관계없이 연결되지만 같은 정책임을 드러내려 넣는다.
      // 목록은 social-link-policy 의 EMAIL_LINKED_SOCIAL_PROVIDERS 하나로 관리해 연결 정책 대상과 어긋나지 않게 한다.
      // Apple '나의 이메일 가리기' 주소는 기존 계정과 겹치지 않아 새 계정이 된다.
      // requireLocalEmailVerified 는 better-auth 1.7.7 기준 deprecated(다음 마이너에서 제거 예정) — 업그레이드 시 google-native·apple-native spec 이 연결 실패를 잡는다
      accountLinking: { enabled: true, trustedProviders: [...EMAIL_LINKED_SOCIAL_PROVIDERS], requireLocalEmailVerified: false },
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
      account: {
        create: {
          before: revokePasswordOnUnverifiedSocialLink,
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
