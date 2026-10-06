import { Inject, Injectable } from '@nestjs/common';
import type { Auth } from './better-auth.provider';
import { BETTER_AUTH, JWT_TTL_SECONDS } from './auth.constants';
import { toHttpException } from './better-auth-error.map';
import { TWO_FACTOR_COOKIE_NAME } from './social-two-factor.hook';

/** 로그인 성공 응답. accessToken = JWT(1h), refreshToken = 세션 토큰(30일) */
export type IssuedTokens = {
  success: true;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
};

export type SignInResult
  = | IssuedTokens
    | { success: true; requiresMfa: true; challengeName: 'TOTP'; session: string };

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
    return { success: true, accessToken: token, refreshToken: sessionToken, expiresIn: JWT_TTL_SECONDS, userId };
  }

  async signIn(email: string, password: string, meta?: RequestMeta): Promise<SignInResult> {
    const { headers, response } = await this.run(() => this.auth.api.signInEmail({
      body: { email, password, rememberMe: true },
      headers: requestHeaders(meta),
      returnHeaders: true,
    }));

    // 2FA 사용자: 세션 대신 two_factor 쿠키가 발급된다. 쿠키 쌍을 그대로 web 에 넘기고(mfa_session 쿠키) verifySecondFactor 에서 되돌려 받는다
    if ((response as unknown as { twoFactorRedirect?: boolean }).twoFactorRedirect) {
      return { success: true, requiresMfa: true, challengeName: 'TOTP', session: cookiePairsFromSetCookie(headers) };
    }
    return this.issueTokens(response.token, response.user.id);
  }

  /** 로그인 2단계: TOTP 또는 백업코드. cookiePairs 는 signIn 이 돌려준 session 값 */
  async verifySecondFactor(cookiePairs: string, code: string, meta?: RequestMeta): Promise<IssuedTokens> {
    const headers = requestHeaders(meta);
    headers.set('cookie', cookiePairs);
    const isBackupCode = !/^\d{6}$/.test(code);

    const response = await this.run(() => isBackupCode
      ? this.auth.api.verifyBackupCode({ body: { code }, headers })
      : this.auth.api.verifyTOTP({ body: { code }, headers }));

    if (!response.token) throw toHttpException(new Error('2FA 검증 후 세션이 생성되지 않았습니다'));
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

  // ---- 소셜 로그인 ----

  /** 제공자 인증 페이지 URL. state 는 better-auth 가 verifications 에 저장하므로 브라우저 쿠키가 필요 없다 */
  async getSocialSignInUrl(provider: 'google', urls: { callbackURL: string; errorCallbackURL: string }): Promise<string> {
    const result = await this.run(() => this.auth.api.signInSocial({
      body: { provider, callbackURL: urls.callbackURL, errorCallbackURL: urls.errorCallbackURL, disableRedirect: true },
    }));
    if (!result.url) throw toHttpException(new Error('소셜 로그인 URL 을 만들지 못했습니다'));
    return result.url;
  }

  /**
   * OAuth 콜백 뒤 api 도메인에 설정된 better-auth 쿠키를 해석한다.
   * - 세션 쿠키가 유효하면 세션 토큰 (web 이 refresh_token 으로 이어받는다)
   * - two_factor 쿠키만 있으면 2FA 챌린지 (web 의 mfa 흐름에 쿠키 쌍을 그대로 넘긴다)
   * expireCookies 는 api 도메인 쿠키를 지우는 set-cookie 줄이다.
   */
  async readSocialCallbackCookies(cookieHeader: string): Promise<
    | { kind: 'session'; sessionToken: string; userId: string; expireCookies: string[] }
    | { kind: 'mfa'; cookiePairs: string; expireCookies: string[] }
    | null
  > {
    const ctx = await this.auth.$context;
    const sessionCookieName = ctx.authCookies.sessionToken.name;
    const twoFactorCookie = ctx.createAuthCookie(TWO_FACTOR_COOKIE_NAME);
    const cookies = parseCookieHeader(cookieHeader);
    const secure = ctx.authCookies.sessionToken.attributes.secure === true;
    const expire = (name: string) => `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
    const expireCookies = [expire(sessionCookieName), expire(twoFactorCookie.name)];

    if (cookies.has(sessionCookieName)) {
      const session = await this.auth.api.getSession({ headers: new Headers({ cookie: cookieHeader }) }).catch(() => null);
      if (session?.session.token) {
        return { kind: 'session', sessionToken: session.session.token, userId: session.user.id, expireCookies };
      }
    }

    const twoFactorValue = cookies.get(twoFactorCookie.name);
    if (twoFactorValue) {
      return { kind: 'mfa', cookiePairs: `${twoFactorCookie.name}=${twoFactorValue}`, expireCookies };
    }
    return null;
  }
}

function parseCookieHeader(header: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    map.set(part.slice(0, idx).trim(), part.slice(idx + 1).trim());
  }
  return map;
}
