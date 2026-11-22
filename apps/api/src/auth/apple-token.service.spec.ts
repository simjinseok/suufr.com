import { generateKeyPairSync } from 'node:crypto';
import { vi } from 'vitest';
import { decodeJwt, decodeProtectedHeader, jwtVerify } from 'jose';
import type { ConfigService } from '@nestjs/config';
import { APPLE_REQUEST_TIMEOUT_MS, APPLE_REVOKE_URL, APPLE_TOKEN_URL, AppleTokenRequestError, AppleTokenService } from './apple-token.service';

const TEAM_ID = 'TEAM123456';
const KEY_ID = 'KEY1234567';
// Apple .p8 과 같은 P-256 PKCS#8 키. env 처럼 줄바꿈을 \n 으로 이스케이프해 넣는다
const appleKey = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const PRIVATE_KEY_ENV = (appleKey.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string).replace(/\n/g, '\\n');
const CONFIGURED = { APPLE_TEAM_ID: TEAM_ID, APPLE_KEY_ID: KEY_ID, APPLE_PRIVATE_KEY: PRIVATE_KEY_ENV };

function makeService(env: Record<string, string | undefined> = CONFIGURED) {
  return new AppleTokenService({ get: (key: string) => env[key] } as unknown as ConfigService);
}

type FetchCall = { url: string; method?: string; signal?: AbortSignal | null; form: URLSearchParams };
function stubFetch(respond: (call: FetchCall) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const call = {
      url: input instanceof Request ? input.url : String(input),
      method: init?.method,
      signal: init?.signal,
      form: new URLSearchParams(String(init?.body)),
    };
    calls.push(call);
    return respond(call);
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AppleTokenService', () => {
  it('Team ID·Key ID·개인키가 모두 있으면 설정된 것으로 본다', () => {
    expect(makeService().isConfigured()).toBe(true);
  });

  it.each(['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'] as const)('%s 하나만 빠져도 설정되지 않은 것으로 본다', (missing) => {
    expect(makeService({ ...CONFIGURED, [missing]: undefined }).isConfigured()).toBe(false);
  });

  it('client secret 은 .p8 키로 서명한 ES256 JWT 다 (kid=Key ID, iss=Team ID, sub=client_id, aud=Apple, 5분)', async () => {
    const now = new Date();
    const secret = await makeService().createClientSecret('com.suufr.ios.dev', now);

    expect(decodeProtectedHeader(secret)).toMatchObject({ alg: 'ES256', kid: KEY_ID });
    const { payload } = await jwtVerify(secret, appleKey.publicKey, {
      issuer: TEAM_ID,
      subject: 'com.suufr.ios.dev',
      audience: 'https://appleid.apple.com',
      currentDate: now,
    });
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(300);
  });

  it('authorization code 를 client_id·client secret 과 함께 POST 로 교환해 토큰을 돌려준다 (타임아웃 신호 포함)', async () => {
    const calls = stubFetch(() => Response.json({ access_token: 'apple-access', refresh_token: 'apple-refresh', id_token: 'x', token_type: 'Bearer', expires_in: 3600 }));

    await expect(makeService().exchangeAuthorizationCode('code-1', 'com.suufr.ios.dev'))
      .resolves.toEqual({ accessToken: 'apple-access', refreshToken: 'apple-refresh' });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: APPLE_TOKEN_URL, method: 'POST' });
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
    expect(Object.fromEntries(calls[0].form)).toMatchObject({ grant_type: 'authorization_code', code: 'code-1', client_id: 'com.suufr.ios.dev' });
    expect(decodeJwt(calls[0].form.get('client_secret') ?? '').sub).toBe('com.suufr.ios.dev');
  });

  it('Apple 이 거부하면 상태·Apple 오류 코드를 담은 AppleTokenRequestError 이고 메시지에 code 는 없다', async () => {
    stubFetch(() => Response.json({ error: 'invalid_grant' }, { status: 400 }));

    const error = await makeService().exchangeAuthorizationCode('code-1', 'com.suufr.ios').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppleTokenRequestError);
    expect(error).toMatchObject({ endpoint: 'token', status: 400, appleError: 'invalid_grant' });
    expect((error as Error).message).not.toContain('code-1');
  });

  it('키 설정이 없으면 Apple 에 요청하지 않고 실패한다', async () => {
    const calls = stubFetch(() => Response.json({}));
    await expect(makeService({}).exchangeAuthorizationCode('code-1', 'com.suufr.ios')).rejects.toThrow('Apple 키 설정');
    expect(calls).toHaveLength(0);
  });

  it('revoke 는 토큰과 종류를 client secret 과 함께 /auth/revoke 로 POST 한다', async () => {
    const calls = stubFetch(() => new Response(null, { status: 200 }));

    await makeService().revoke('apple-refresh', 'com.suufr.ios');

    expect(calls[0]).toMatchObject({ url: APPLE_REVOKE_URL, method: 'POST' });
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
    expect(Object.fromEntries(calls[0].form)).toMatchObject({ token: 'apple-refresh', token_type_hint: 'refresh_token', client_id: 'com.suufr.ios' });
    expect(decodeJwt(calls[0].form.get('client_secret') ?? '').sub).toBe('com.suufr.ios');
  });

  it('revoke 는 넘긴 토큰 종류를 token_type_hint 로 보낸다', async () => {
    const calls = stubFetch(() => new Response(null, { status: 200 }));

    await makeService().revoke('apple-access', 'com.suufr.ios', 'access_token');

    expect(Object.fromEntries(calls[0].form)).toMatchObject({ token: 'apple-access', token_type_hint: 'access_token' });
  });

  it.each([
    ['교환', (service: AppleTokenService) => service.exchangeAuthorizationCode('code-1', 'com.suufr.ios')],
    ['폐기', (service: AppleTokenService) => service.revoke('apple-refresh', 'com.suufr.ios')],
  ])('%s 요청은 5초 타임아웃 신호를 단다 (Apple 장애가 로그인을 오래 붙잡지 않게)', async (_, call) => {
    // AbortSignal.timeout 은 Node 내부 타이머라 가짜 타이머로 진행할 수 없어, 만든 신호를 그대로 fetch 에 넘기는지와 시간 값을 본다
    expect(APPLE_REQUEST_TIMEOUT_MS).toBe(5000);
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const calls = stubFetch(() => Response.json({ refresh_token: 'r' }));

    await call(makeService());

    expect(timeout).toHaveBeenCalledWith(APPLE_REQUEST_TIMEOUT_MS);
    expect(calls[0].signal).toBe(timeout.mock.results[0]?.value);
  });

  it('revoke 실패는 endpoint=revoke 인 AppleTokenRequestError', async () => {
    stubFetch(() => Response.json({ error: 'invalid_client' }, { status: 400 }));
    await expect(makeService().revoke('apple-refresh', 'com.suufr.ios'))
      .rejects.toMatchObject({ endpoint: 'revoke', status: 400, appleError: 'invalid_client' });
  });
});
