import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importPKCS8, SignJWT } from 'jose';

export const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
export const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
/** client secret 은 요청마다 만들므로 짧게 둔다 (Apple 상한은 6개월) */
export const APPLE_CLIENT_SECRET_TTL_SECONDS = 300;
/** 로그인 요청 안에서 기다리므로 Apple 장애가 로그인을 오래 붙잡지 않게 한다 */
export const APPLE_REQUEST_TIMEOUT_MS = 5000;
const APPLE_AUDIENCE = 'https://appleid.apple.com';

/** Apple 토큰·폐기 요청 실패. authorization code·토큰 값은 담지 않는다 (Sentry 로 그대로 보낼 수 있게) */
export class AppleTokenRequestError extends Error {
  constructor(readonly endpoint: 'token' | 'revoke', readonly status: number, readonly appleError?: string) {
    super(`Apple ${endpoint} 요청 실패: ${status} ${appleError ?? ''}`.trim());
    this.name = 'AppleTokenRequestError';
  }
}

export type AppleTokenExchangeResult = { accessToken?: string; refreshToken?: string };

/**
 * Sign in with Apple 서버 API. 탈퇴 시 Apple 토큰 폐기(App Store 심사 가이드라인 5.1.1(v))에 쓸 refresh token 을
 * authorization code 교환으로 받고, 폐기 요청을 보낸다.
 * client_id 는 identity token 의 aud(번들 ID)다. 키는 primary App ID(com.suufr.ios) 그룹의 Sign in with Apple 키라
 * 같은 그룹의 dev 번들도 이 키로 서명한다.
 */
@Injectable()
export class AppleTokenService {
  private readonly teamId?: string;
  private readonly keyId?: string;
  private readonly privateKey?: string;
  private signingKey?: Promise<CryptoKey>;

  constructor(config: ConfigService) {
    this.teamId = config.get<string>('APPLE_TEAM_ID') || undefined;
    this.keyId = config.get<string>('APPLE_KEY_ID') || undefined;
    // .p8 본문을 env 한 줄로 넣으므로 \n 이스케이프를 줄바꿈으로 되돌린다 (CLOUDFRONT_PRIVATE_KEY 와 같은 방식)
    this.privateKey = config.get<string>('APPLE_PRIVATE_KEY')?.replace(/\\n/g, '\n') || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.teamId && this.keyId && this.privateKey);
  }

  /** ES256 client secret JWT (kid=Key ID, iss=Team ID, sub=client_id, aud=https://appleid.apple.com) */
  async createClientSecret(clientId: string, now: Date = new Date()): Promise<string> {
    if (!this.teamId || !this.keyId || !this.privateKey) {
      throw new Error('Apple 키 설정(APPLE_TEAM_ID·APPLE_KEY_ID·APPLE_PRIVATE_KEY)이 없습니다');
    }
    this.signingKey ??= importPKCS8(this.privateKey, 'ES256');
    const iat = Math.floor(now.getTime() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: this.keyId })
      .setIssuer(this.teamId)
      .setSubject(clientId)
      .setAudience(APPLE_AUDIENCE)
      .setIssuedAt(iat)
      .setExpirationTime(iat + APPLE_CLIENT_SECRET_TTL_SECONDS)
      .sign(await this.signingKey);
  }

  /** 5분·1회용 authorization code → 토큰. refresh token 은 만료가 없다 */
  async exchangeAuthorizationCode(code: string, clientId: string): Promise<AppleTokenExchangeResult> {
    const response = await this.post('token', {
      client_id: clientId,
      client_secret: await this.createClientSecret(clientId),
      code,
      grant_type: 'authorization_code',
    });
    const body = await response.json() as { access_token?: string; refresh_token?: string };
    return { accessToken: body.access_token, refreshToken: body.refresh_token };
  }

  /** 토큰 폐기. 탈퇴 기능이 호출한다 (이번에는 호출처 없음) */
  async revoke(token: string, clientId: string, tokenTypeHint: 'refresh_token' | 'access_token' = 'refresh_token'): Promise<void> {
    await this.post('revoke', {
      client_id: clientId,
      client_secret: await this.createClientSecret(clientId),
      token,
      token_type_hint: tokenTypeHint,
    });
  }

  private async post(endpoint: 'token' | 'revoke', form: Record<string, string>): Promise<Response> {
    const response = await fetch(endpoint === 'token' ? APPLE_TOKEN_URL : APPLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(APPLE_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      throw new AppleTokenRequestError(endpoint, response.status, body?.error);
    }
    return response;
  }
}
