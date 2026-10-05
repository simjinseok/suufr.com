import { Inject, Injectable } from '@nestjs/common';
import { APIError } from 'better-auth/api';
import type { Auth } from './better-auth.provider';
import { BETTER_AUTH, JWT_TTL_SECONDS } from './auth.constants';
import { betterAuthErrorCode, toHttpException } from './better-auth-error.map';
import { COGNITO_ERROR_CODES } from './cognito-migration.hook';

/** 로그인 성공 응답 — 기존 Cognito 응답과 같은 필드명 (web 변경 최소화). cognitoUsername 에는 user.id 를 넣는다 */
export type IssuedTokens = {
  success: true;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  cognitoUsername: string;
};

export type SignInResult
  = | IssuedTokens
    | { success: true; requiresMfa: true; challengeName: 'TOTP'; session: string }
    | { success: true; requiresNewPassword: true; challengeName: 'NEW_PASSWORD_REQUIRED'; session: string };

export type RequestMeta = { ip?: string; userAgent?: string };

function bearerHeaders(sessionToken: string): Headers {
  return new Headers({ authorization: `Bearer ${sessionToken}` });
}

function requestHeaders(meta?: RequestMeta): Headers {
  const headers = new Headers();
  if (meta?.ip) headers.set('x-forwarded-for', meta.ip);
  if (meta?.userAgent) headers.set('user-agent', meta.userAgent);
  return headers;
}

/** set-cookie 헤더 배열 → "name=value; name2=value2" (다음 auth.api 호출의 cookie 헤더) */
function cookiePairsFromSetCookie(headers: Headers): string {
  return headers.getSetCookie()
    .map(line => line.split(';')[0]?.trim() ?? '')
    // 값이 빈 쿠키는 삭제 지시(session_token= 등)이므로 제외
    .filter(pair => pair.includes('=') && !pair.endsWith('='))
    .join('; ');
}

/**
 * better-auth 서버 API 래퍼. 컨트롤러는 이 서비스만 호출하고, 모든 APIError 는 한국어 HttpException 으로 바뀐다.
 * HTTP 핸들러(/api/better-auth/*)를 거치지 않고 auth.api.* 를 직접 호출한다.
 */
@Injectable()
export class BetterAuthService {
  constructor(@Inject(BETTER_AUTH) private readonly auth: Auth) {}

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    }
    catch (error) {
      throw toHttpException(error);
    }
  }

  /** 세션 토큰(= refresh_token 쿠키) → 1시간 JWT(= access_token 쿠키) */
  async issueTokens(sessionToken: string, userId: string): Promise<IssuedTokens> {
    const { token } = await this.run(() => this.auth.api.getToken({ headers: bearerHeaders(sessionToken) }));
    return { success: true, accessToken: token, refreshToken: sessionToken, expiresIn: JWT_TTL_SECONDS, cognitoUsername: userId };
  }

  async signIn(email: string, password: string, meta?: RequestMeta): Promise<SignInResult> {
    try {
      const { headers, response } = await this.auth.api.signInEmail({
        body: { email, password, rememberMe: true },
        headers: requestHeaders(meta),
        returnHeaders: true,
      });

      // 2FA 사용자: 세션 대신 two_factor 쿠키가 발급된다. 쿠키 쌍을 그대로 web 에 넘기고(mfa_session 쿠키) verifyTotp 에서 되돌려 받는다
      if ((response as unknown as { twoFactorRedirect?: boolean }).twoFactorRedirect) {
        return { success: true, requiresMfa: true, challengeName: 'TOTP', session: cookiePairsFromSetCookie(headers) };
      }
      return await this.issueTokens(response.token, response.user.id);
    }
    catch (error) {
      // lazy migration 훅이 Cognito 임시 비밀번호 계정을 발견 — 레거시 new-password 경로로 안내
      if (error instanceof APIError && betterAuthErrorCode(error) === COGNITO_ERROR_CODES.NEW_PASSWORD_REQUIRED) {
        const session = (error.body as { session?: string } | undefined)?.session;
        if (session) return { success: true, requiresNewPassword: true, challengeName: 'NEW_PASSWORD_REQUIRED', session };
      }
      throw toHttpException(error);
    }
  }

  /** 로그인 2단계: TOTP 또는 백업코드. cookiePairs 는 signIn 이 돌려준 session 값 */
  async verifySecondFactor(cookiePairs: string, code: string, meta?: RequestMeta): Promise<IssuedTokens> {
    const headers = requestHeaders(meta);
    headers.set('cookie', cookiePairs);
    const isBackupCode = !/^\d{6}$/.test(code);

    const response = await this.run(() => isBackupCode
      ? this.auth.api.verifyBackupCode({ body: { code }, headers })
      : this.auth.api.verifyTOTP({ body: { code }, headers }));

    if (!response.token) throw toHttpException(new APIError('UNAUTHORIZED', { code: 'FAILED_TO_CREATE_SESSION', message: 'session missing' }));
    return this.issueTokens(response.token, response.user.id);
  }

  /** refresh_token(세션 토큰)으로 새 JWT. 세션이 만료·폐기됐으면 401 */
  async refresh(sessionToken: string): Promise<{ success: true; accessToken: string; expiresIn: number }> {
    const { token } = await this.run(() => this.auth.api.getToken({ headers: bearerHeaders(sessionToken) }));
    return { success: true, accessToken: token, expiresIn: JWT_TTL_SECONDS };
  }

  async signOut(sessionToken: string): Promise<void> {
    try {
      await this.auth.api.signOut({ headers: bearerHeaders(sessionToken) });
    }
    catch {
      // 이미 만료된 세션 — 로그아웃은 항상 성공으로 취급
    }
  }

  /** 가입. requireEmailVerification 이라 세션은 없고 OTP 메일이 발송된다. 중복 이메일이면 합성 사용자(무작위 id) */
  async signUp(name: string, email: string, password: string): Promise<{ userId: string }> {
    const { user } = await this.run(() => this.auth.api.signUpEmail({ body: { name, email, password } }));
    return { userId: user.id };
  }

  async verifyEmail(email: string, otp: string): Promise<void> {
    await this.run(() => this.auth.api.verifyEmailOTP({ body: { email, otp } }));
  }

  async resendVerification(email: string): Promise<void> {
    await this.run(() => this.auth.api.sendVerificationOTP({ body: { email, type: 'email-verification' } }));
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.run(() => this.auth.api.requestPasswordResetEmailOTP({ body: { email } }));
  }

  async resetPassword(email: string, otp: string, password: string): Promise<void> {
    await this.run(() => this.auth.api.resetPasswordEmailOTP({ body: { email, otp, password } }));
  }

  // ---- 2단계 인증 관리 (로그인 상태, 세션 토큰 필요) ----

  async enableTwoFactor(sessionToken: string, password: string): Promise<{ totpURI: string; backupCodes: string[] }> {
    const result = await this.run(() => this.auth.api.enableTwoFactor({ body: { password, method: 'totp' }, headers: bearerHeaders(sessionToken) }));
    if (result.method !== 'totp') throw toHttpException(new Error('unexpected two-factor method'));
    return { totpURI: result.totpURI, backupCodes: result.backupCodes };
  }

  /** 등록 확인: 인증 앱 코드가 맞으면 twoFactorEnabled=true */
  async verifyTwoFactorSetup(sessionToken: string, code: string): Promise<void> {
    await this.run(() => this.auth.api.verifyTOTP({ body: { code }, headers: bearerHeaders(sessionToken) }));
  }

  async disableTwoFactor(sessionToken: string, password: string): Promise<void> {
    await this.run(() => this.auth.api.disableTwoFactor({ body: { password }, headers: bearerHeaders(sessionToken) }));
  }

  async regenerateBackupCodes(sessionToken: string, password: string): Promise<string[]> {
    const result = await this.run(() => this.auth.api.generateBackupCodes({ body: { password }, headers: bearerHeaders(sessionToken) }));
    return result.backupCodes;
  }

  /** JWKS 공개키 (가드가 로컬 검증에 사용) */
  async getJwks() {
    return this.auth.api.getJwks();
  }
}
