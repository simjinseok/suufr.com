import { Inject, Injectable } from '@nestjs/common';
import type { Auth } from './better-auth.provider';
import { BETTER_AUTH, JWT_TTL_SECONDS } from './auth.constants';
import { toHttpException } from './better-auth-error.map';

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

  /**
   * 제공자 인증 페이지 URL 과, better-auth 가 함께 발급하는 서명된 state 쿠키(set-cookie 줄).
   * state 는 verifications 에도 저장되지만 콜백에서 이 쿠키까지 대조하므로(login CSRF 방어),
   * 호출자는 쿠키를 브라우저 응답에 그대로 실어야 한다 (SocialLoginController.start).
   */
  async getSocialSignInUrl(provider: 'google', urls: { callbackURL: string; errorCallbackURL: string }): Promise<{ url: string; setCookies: string[] }> {
    const { headers, response } = await this.run(() => this.auth.api.signInSocial({
      body: { provider, callbackURL: urls.callbackURL, errorCallbackURL: urls.errorCallbackURL, disableRedirect: true },
      returnHeaders: true,
    }));
    if (!response.url) throw toHttpException(new Error('소셜 로그인 URL 을 만들지 못했습니다'));
    return { url: response.url, setCookies: headers.getSetCookie() };
  }

  /**
   * Google ID 토큰 로그인 (iOS 네이티브 Google Sign-In SDK).
   * better-auth 가 Google 공개키로 서명·issuer·audience(GOOGLE_CLIENT_ID + GOOGLE_ID_TOKEN_AUDIENCES)·만료를 검증하고,
   * 이메일 기준으로 기존 사용자에 연결하거나 새로 만든 뒤 세션을 발급한다. 소셜 로그인은 2단계 인증을 묻지 않는다.
   * 토큰이 유효하지 않으면 better-auth 가 INVALID_TOKEN(401) 을 던진다.
   */
  async signInWithGoogleIdToken(idToken: string, meta?: RequestMeta): Promise<IssuedTokens> {
    const response = await this.run(() => this.auth.api.signInSocial({
      body: { provider: 'google', idToken: { token: idToken } },
      headers: requestHeaders(meta),
    }));
    // idToken 분기는 리다이렉트 없이 세션 토큰과 사용자를 돌려준다 (url 만 있는 응답은 브라우저 OAuth 분기)
    if (!('token' in response) || !response.token || !response.user) {
      throw toHttpException(new Error('Google 로그인 후 세션이 생성되지 않았습니다'));
    }
    return this.issueTokens(response.token, response.user.id);
  }

  /**
   * OAuth 콜백 뒤 api 도메인에 설정된 better-auth 세션 쿠키를 해석해 세션 토큰을 돌려준다 (web 이 refresh_token 으로 이어받는다).
   * 소셜 로그인은 Google 이 본인 확인을 끝낸 뒤라 2단계 인증을 다시 묻지 않는다.
   * expireCookies 는 api 도메인 쿠키를 지우는 set-cookie 줄이다.
   */
  async readSocialCallbackCookies(cookieHeader: string): Promise<{ sessionToken: string; userId: string; expireCookies: string[] } | null> {
    const ctx = await this.auth.$context;
    const sessionCookieName = ctx.authCookies.sessionToken.name;
    const cookies = parseCookieHeader(cookieHeader);
    if (!cookies.has(sessionCookieName)) return null;

    const session = await this.auth.api.getSession({ headers: new Headers({ cookie: cookieHeader }) }).catch(() => null);
    if (!session?.session.token) return null;

    const secure = ctx.authCookies.sessionToken.attributes.secure === true;
    const expireCookies = [`${sessionCookieName}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`];
    return { sessionToken: session.session.token, userId: session.user.id, expireCookies };
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
