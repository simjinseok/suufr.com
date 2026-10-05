import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { JwtAuthGuard, peekIssuer } from './jwt-auth.guard';
import type { BetterAuthService } from '../better-auth/better-auth.service';

const ISSUER = 'https://api.example.test';

function makeConfig(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function makeContext(authorization?: string, isPublic = false) {
  const request: { headers: Record<string, string | undefined>; user?: unknown } = { headers: { authorization } };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector;
  return { context, request, reflector };
}

async function makeKeys() {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'kid-1';
  jwk.alg = 'EdDSA';
  return { privateKey, jwks: { keys: [jwk] } };
}

type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

async function signToken(privateKey: PrivateKey, claims: Record<string, unknown>, opts: { iss?: string; aud?: string; kid?: string; exp?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'EdDSA', kid: opts.kid ?? 'kid-1' })
    .setIssuer(opts.iss ?? ISSUER)
    .setAudience(opts.aud ?? ISSUER)
    .setSubject(String(claims.sub ?? '11111111-1111-4111-8111-111111111111'))
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '1h')
    .sign(privateKey);
}

describe('JwtAuthGuard', () => {
  it('@Public() 라우트는 토큰 없이 통과한다', async () => {
    const { context, reflector } = makeContext(undefined, true);
    const guard = new JwtAuthGuard(reflector, makeConfig({}));
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('토큰이 없으면 401', async () => {
    const { context, reflector } = makeContext(undefined);
    const guard = new JwtAuthGuard(reflector, makeConfig({}));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('better-auth JWT 를 JWKS 로 검증하고 request.user 를 주입한다', async () => {
    const { privateKey, jwks } = await makeKeys();
    const getJwks = vi.fn().mockResolvedValue(jwks);
    const token = await signToken(privateKey, { sub: '11111111-1111-4111-8111-111111111111', email: 'a@example.com', name: '가나' });
    const { context, request, reflector } = makeContext(`Bearer ${token}`);
    const guard = new JwtAuthGuard(reflector, makeConfig({ BETTER_AUTH_URL: ISSUER }), { getJwks } as unknown as BetterAuthService);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ userId: '11111111-1111-4111-8111-111111111111', email: 'a@example.com', username: '가나' });

    // 두 번째 요청은 캐시된 JWKS 를 쓴다
    await guard.canActivate(makeContext(`Bearer ${token}`).context);
    expect(getJwks).toHaveBeenCalledTimes(1);
  });

  it('모르는 kid 가 오면 JWKS 를 다시 읽는다 (키 로테이션)', async () => {
    const first = await makeKeys();
    const second = await makeKeys();
    second.jwks.keys[0]!.kid = 'kid-2';
    const getJwks = vi.fn().mockResolvedValueOnce(first.jwks).mockResolvedValueOnce({ keys: [...first.jwks.keys, ...second.jwks.keys] });
    const guard = new JwtAuthGuard(makeContext().reflector, makeConfig({ BETTER_AUTH_URL: ISSUER }), { getJwks } as unknown as BetterAuthService);

    await guard.canActivate(makeContext(`Bearer ${await signToken(first.privateKey, {})}`).context);
    await guard.canActivate(makeContext(`Bearer ${await signToken(second.privateKey, {}, { kid: 'kid-2' })}`).context);
    expect(getJwks).toHaveBeenCalledTimes(2);
  });

  it('aud 가 다르거나 만료된 better-auth JWT 는 401', async () => {
    const { privateKey, jwks } = await makeKeys();
    const guard = new JwtAuthGuard(makeContext().reflector, makeConfig({ BETTER_AUTH_URL: ISSUER }), { getJwks: async () => jwks } as unknown as BetterAuthService);

    const wrongAud = await signToken(privateKey, {}, { aud: 'https://other.example.test' });
    await expect(guard.canActivate(makeContext(`Bearer ${wrongAud}`).context)).rejects.toBeInstanceOf(UnauthorizedException);

    const expired = await signToken(privateKey, {}, { exp: '-10s' });
    await expect(guard.canActivate(makeContext(`Bearer ${expired}`).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('iss 가 better-auth 가 아니고 Cognito 수용이 꺼져 있으면 401', async () => {
    const { privateKey } = await makeKeys();
    const token = await signToken(privateKey, {}, { iss: 'https://cognito-idp.ap-northeast-2.amazonaws.com/ap-northeast-2_x' });
    const guard = new JwtAuthGuard(makeContext().reflector, makeConfig({ BETTER_AUTH_URL: ISSUER, AUTH_ACCEPT_COGNITO_TOKENS: 'false' }));
    await expect(guard.canActivate(makeContext(`Bearer ${token}`).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('peekIssuer 는 서명 검증 없이 iss 만 읽는다', async () => {
    const { privateKey } = await makeKeys();
    expect(peekIssuer(await signToken(privateKey, {}))).toBe(ISSUER);
    expect(peekIssuer('not-a-jwt')).toBeUndefined();
    expect(peekIssuer('a.b.c')).toBeUndefined();
  });
});
