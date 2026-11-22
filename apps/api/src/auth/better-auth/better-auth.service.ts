import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { decodeJwt } from 'jose';
import type { AuthContext } from 'better-auth';
import { setTokenUtil } from 'better-auth/oauth2';
import { AppleTokenService } from '../apple-token.service';
import type { Auth } from './better-auth.provider';
import { BETTER_AUTH, JWT_TTL_SECONDS } from './auth.constants';
import { APPLE_SIGN_IN_FAILED_MESSAGE, APPLE_SIGN_IN_MESSAGES, toHttpException } from './better-auth-error.map';
import { rethrowOtpMailFailure } from './otp-mail-failure';

const logger = new Logger('BetterAuthService');

export type SocialSignInUrls = {
  callbackURL: string;
  errorCallbackURL: string;
  /** 신규 가입자(이번 콜백에서 사용자가 만들어진 경우)만 보낼 주소. 없으면 callbackURL */
  newUserCallbackURL: string;
};

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

/** iOS Sign in with Apple 결과. nonce 는 원문(iOS 는 그 SHA-256 을 Apple 요청에 넣었다) */
export type AppleIdTokenSignIn = { idToken: string; nonce: string; authorizationCode?: string; name?: string };

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

/**
 * identity token 의 nonce 클레임이 원문 nonce 의 SHA-256 인지. better-auth 는 원문과 클레임이 같아도 통과시키므로
 * (verify-id-token.mjs exact-or-sha256), 토큰에서 읽은 클레임 값을 그대로 보내는 재전송을 여기서 막는다. 서명 검증은 better-auth 가 한다
 */
function appleNonceMatches(idToken: string, nonce: string): boolean {
  if (!nonce) return false;
  try {
    return decodeJwt(idToken).nonce === sha256Hex(nonce);
  }
  catch {
    return false;
  }
}

function bearerHeaders(sessionToken: string): Headers {
  return new Headers({ authorization: `Bearer ${sessionToken}` });
}

/** 메일 인증코드 실패 한도: 이메일마다 1시간에 10번. 6자리(100만 가지)라 하루 최대 240번 → 하루 성공 확률 약 0.024% */
const OTP_FAILURE_LIMIT = 10;
const OTP_FAILURE_WINDOW_MS = 60 * 60 * 1000;
/** 틀린 코드로 세는 better-auth 에러 코드 (만료·코드당 시도 초과 포함) */
const OTP_FAILURE_CODES = new Set(['INVALID_OTP', 'OTP_EXPIRED', 'TOO_MANY_ATTEMPTS']);

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
  /** appleTokens 는 Nest 에서는 항상 주입된다. 선택 인자인 것은 Apple 과 무관한 spec 이 auth 만으로 만들 수 있게 하려는 것 */
  constructor(@Inject(BETTER_AUTH) private readonly auth: Auth, private readonly appleTokens?: AppleTokenService) {}

  /** '종류:이메일' → 최근 1시간 안의 인증코드 실패 시각들 (checkOtp) */
  private readonly otpFailures = new Map<string, number[]>();

  /** auth.api 호출. APIError 는 한국어 HttpException 으로(messages 로 provider 별 문구 덮어쓰기), better-auth 가 삼킨 OTP 메일 실패는 503 으로 바꾼다 */
  private async run<T>(fn: () => Promise<T>, messages?: Readonly<Record<string, string>>): Promise<T> {
    try {
      return await rethrowOtpMailFailure(fn);
    }
    catch (error) {
      throw toHttpException(error, messages);
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

  /**
   * 이메일 인증(OTP). 인증이 끝나면 소유권 증명 전에 생긴 세션을 폐기한다 — 인증을 요청한 세션
   * (callerSessionToken, 그 사용자의 것일 때만)만 남기고, 토큰이 없거나 다른 사용자·만료된 토큰이면 전부 폐기한다.
   *
   * 미인증이던 계정이면 바로 로그인 토큰을 돌려준다(가입·로그인 뒤 인증코드 화면 → 바로 앱).
   * 이미 인증된 계정이나 2단계 인증을 켠 계정은 null 이다 — 메일 코드만으로 비밀번호·2단계 인증을 건너뛰게 되기 때문.
   * 이때 호출자는 로그인 화면으로 보낸다.
   */
  async verifyEmail(email: string, otp: string, callerSessionToken?: string, meta?: RequestMeta): Promise<IssuedTokens | null> {
    const ctx = await this.auth.$context;
    const before = await ctx.internalAdapter.findUserByEmail(email.toLowerCase());
    const { user } = await this.checkOtp('email-verification', email, () => this.auth.api.verifyEmailOTP({ body: { email, otp } }));

    const wasUnverified = before?.user.id === user.id && !before.user.emailVerified;
    // 이미 인증된 계정이면 '소유권 증명 전 세션'이 없으니 지우지 않는다(코드를 다시 받아 넣어도 다른 기기 로그인이 풀리지 않게)
    if (wasUnverified) await this.revokeUnprovenSessions(user.id, callerSessionToken);

    const twoFactorEnabled = (before?.user as { twoFactorEnabled?: boolean | null } | undefined)?.twoFactorEnabled === true;
    if (!wasUnverified || twoFactorEnabled) return null;

    const session = await this.run(() => ctx.internalAdapter.createSession(user.id, false, {
      ...(meta?.ip ? { ipAddress: meta.ip } : {}),
      ...(meta?.userAgent ? { userAgent: meta.userAgent } : {}),
    }));
    return this.issueTokens(session.token, user.id);
  }

  /**
   * 비밀번호 계정이 있는데 이메일이 미인증인 사용자인지. 2단계 인증 설정·Google 연동을 막는 데 쓴다(방어용).
   * 비밀번호 없이 Google 로만 가입한 사용자는 인증 여부와 관계없이 false 다.
   */
  async isUnverifiedPasswordUser(userId: string): Promise<boolean> {
    const { internalAdapter } = await this.auth.$context;
    const user = await internalAdapter.findUserById(userId);
    if (!user || user.emailVerified) return false;
    const accounts = await internalAdapter.findAccounts(userId);
    return accounts.some(account => account.providerId === 'credential');
  }

  private async revokeUnprovenSessions(userId: string, keepSessionToken?: string): Promise<void> {
    if (keepSessionToken) {
      const current = await this.auth.api.getSession({ headers: bearerHeaders(keepSessionToken) }).catch(() => null);
      if (current?.user.id === userId) {
        await this.run(() => this.auth.api.revokeOtherSessions({ headers: bearerHeaders(keepSessionToken) }));
        return;
      }
    }
    const { internalAdapter } = await this.auth.$context;
    await internalAdapter.deleteUserSessions(userId);
  }

  async resendVerification(email: string): Promise<void> {
    await this.run(() => this.auth.api.sendVerificationOTP({ body: { email, type: 'email-verification' } }));
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.run(() => this.auth.api.requestPasswordResetEmailOTP({ body: { email } }));
  }

  async resetPassword(email: string, otp: string, password: string): Promise<void> {
    await this.checkOtp('password-reset', email, () => this.auth.api.resetPasswordEmailOTP({ body: { email, otp, password } }));
  }

  /**
   * 메일 인증코드 확인. 이메일마다 1시간에 OTP_FAILURE_LIMIT 번 틀리면 코드를 확인하지 않고 429 로 거부한다.
   * better-auth 의 시도 제한(코드 하나당 5번)은 코드를 다시 받으면 처음부터라서, 재발송을 반복하며 6자리를 맞히는 것을 막지 못한다.
   * 이 카운터는 재발송해도 줄지 않고, 맞히면 비운다. 프로세스 메모리에 두므로 api 가 한 프로세스라는 전제다.
   */
  private async checkOtp<T>(kind: 'email-verification' | 'password-reset', email: string, fn: () => Promise<T>): Promise<T> {
    const key = `${kind}:${email.trim().toLowerCase()}`;
    const now = Date.now();
    const recent = (this.otpFailures.get(key) ?? []).filter(at => now - at < OTP_FAILURE_WINDOW_MS);
    if (recent.length >= OTP_FAILURE_LIMIT) {
      this.otpFailures.set(key, recent);
      throw new HttpException(
        { message: '인증코드를 너무 많이 틀렸습니다. 1시간 뒤에 다시 시도해주세요.', error: 'TOO_MANY_OTP_FAILURES' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    try {
      const result = await this.run(fn);
      this.otpFailures.delete(key);
      return result;
    }
    catch (error) {
      const code = error instanceof HttpException ? (error.getResponse() as { error?: string }).error : undefined;
      if (code && OTP_FAILURE_CODES.has(code)) {
        this.otpFailures.set(key, [...recent, now]);
      }
      else if (recent.length) {
        this.otpFailures.set(key, recent);
      }
      else {
        this.otpFailures.delete(key);
      }
      throw error;
    }
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

  /**
   * 비밀번호 재확인 (계정 삭제). better-auth deleteUser 와 같은 방식 — credential 계정의 해시를 better-auth 의 password.verify 로 대조한다.
   * 비밀번호가 없는 계정(Google 전용 등)이면 false.
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const ctx = await this.auth.$context;
    const account = await ctx.internalAdapter.findCredentialAccount(userId);
    if (!account?.password) return false;
    return ctx.password.verify({ hash: account.password, password });
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
  async getSocialSignInUrl(provider: 'google', urls: SocialSignInUrls): Promise<{ url: string; setCookies: string[] }> {
    const { headers, response } = await this.run(() => this.auth.api.signInSocial({
      body: {
        provider,
        callbackURL: urls.callbackURL,
        errorCallbackURL: urls.errorCallbackURL,
        newUserCallbackURL: urls.newUserCallbackURL,
        disableRedirect: true,
      },
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
   * Apple identity token 로그인 (iOS AuthenticationServices).
   * better-auth 가 Apple 공개키로 서명·issuer·audience(APPLE_APP_BUNDLE_ID + APPLE_ID_TOKEN_AUDIENCES)·만료·nonce 를 검증하고,
   * 이메일 기준으로 기존 사용자에 연결하거나 새로 만든 뒤 세션을 발급한다. 소셜 로그인은 2단계 인증을 묻지 않는다.
   * authorizationCode 가 있으면 탈퇴 시 revoke 용 refresh token 을 받아 암호화 저장한다(실패해도 로그인은 성공).
   * 검증 실패는 Apple 로그인 실패 안내(401 INVALID_TOKEN 등)로 끝난다.
   */
  async signInWithAppleIdToken(input: AppleIdTokenSignIn, meta?: RequestMeta): Promise<IssuedTokens> {
    // better-auth 는 nonce 가 비면 검사를 건너뛰고, 원문 일치도 허용한다 — 둘 다 여기서 막는다
    if (!appleNonceMatches(input.idToken, input.nonce)) {
      throw new UnauthorizedException({ message: APPLE_SIGN_IN_FAILED_MESSAGE, error: 'INVALID_TOKEN' });
    }
    // iOS 가 기기 로캘 순서로 조합한 전체 이름을 firstName 하나로 보낸다 (better-auth 는 "first last" 순서로 붙인다). 가입 때만 반영된다
    const name = input.name?.trim();
    const response = await this.run(() => this.auth.api.signInSocial({
      body: {
        provider: 'apple',
        idToken: { token: input.idToken, nonce: input.nonce, ...(name ? { user: { name: { firstName: name } } } : {}) },
      },
      headers: requestHeaders(meta),
    }), APPLE_SIGN_IN_MESSAGES);
    if (!('token' in response) || !response.token || !response.user) {
      throw toHttpException(new Error('Apple 로그인 후 세션이 생성되지 않았습니다'));
    }
    if (input.authorizationCode) await this.storeAppleRefreshToken(response.user.id, input.idToken, input.authorizationCode);
    return this.issueTokens(response.token, response.user.id);
  }

  /** authorization code → refresh token 을 apple 계정 행에 better-auth 암호화로 저장. 절대 던지지 않는다 */
  private async storeAppleRefreshToken(userId: string, idToken: string, code: string): Promise<void> {
    if (!this.appleTokens?.isConfigured()) return;
    try {
      // better-auth 가 방금 서명·audience 를 검증한 토큰이라 디코드만 한다. client_id 는 토큰을 받은 앱의 번들 ID(허용 목록 안의 aud)
      const { sub, aud } = decodeJwt(idToken);
      const allowed = this.auth.options.socialProviders.apple?.audience ?? [];
      const clientId = [aud ?? []].flat().find(value => allowed.includes(value));
      if (!sub || !clientId) {
        logger.warn(`Apple identity token 의 aud 가 허용 목록에 없어 code 교환을 건너뜁니다 (userId=${userId})`);
        return;
      }
      const ctx = await this.auth.$context;
      const account = await ctx.internalAdapter.findAccountByKey({ providerId: 'apple', accountId: sub });
      if (!account) return;
      // code 가 오면 저장된 토큰이 있어도 교환해 덮어쓴다. 사용자가 기기 설정에서 'Apple로 로그인 사용 중단' 후 재승인하면
      // 저장된 토큰은 무효라 탈퇴 때 폐기할 수 없기 때문이다. 교환이 실패하거나 응답에 토큰이 없으면 저장된 값을 그대로 둔다
      const { refreshToken } = await this.appleTokens.exchangeAuthorizationCode(code, clientId);
      if (!refreshToken) return;
      await ctx.internalAdapter.updateAccount(account.id, { refreshToken: (await setTokenUtil(refreshToken, ctx as unknown as AuthContext)) ?? undefined });
    }
    catch (error) {
      // revoke 용일 뿐이라 로그인은 성공시킨다. 다음 로그인(code 포함)에 다시 시도된다. code·토큰 값은 싣지 않는다
      logger.warn(`Apple authorization code 교환 실패 (userId=${userId})`);
      Sentry.captureException(error, { extra: { stage: 'apple-code-exchange', userId } });
    }
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
