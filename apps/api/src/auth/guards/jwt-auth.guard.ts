import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createLocalJWKSet, decodeProtectedHeader, jwtVerify, type JSONWebKeySet, type JWTPayload } from 'jose';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { BetterAuthService } from '../better-auth/better-auth.service';

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  /** 표시 이름 (better-auth user.name) */
  username?: string;
}

type JwksGetter = ReturnType<typeof createLocalJWKSet>;

const JWKS_RELOAD_COOLDOWN_MS = 60_000;

/**
 * 전역 가드. Authorization: Bearer <better-auth JWT> 를 jose + JWKS(DB, 프로세스 캐시) 로 로컬 검증해 request.user 를 주입한다.
 * iss/aud 는 BETTER_AUTH_URL. 공개 라우트는 @Public().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private jwks: JwksGetter | null = null;
  private jwksKids = new Set<string>();
  private jwksLoadedAt = 0;

  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
    private betterAuth: BetterAuthService,
  ) {}

  private get issuer(): string {
    const issuer = this.configService.get<string>('BETTER_AUTH_URL');
    if (!issuer) throw new Error('BETTER_AUTH_URL must be provided');
    return issuer;
  }

  /**
   * JWKS 는 거의 바뀌지 않으므로 프로세스에 캐시한다. 모르는 kid 가 오면(키 로테이션) 다시 읽되,
   * 위조 kid 로 DB 조회를 유발하지 못하도록 재조회는 JWKS_RELOAD_COOLDOWN_MS 에 1회로 제한한다.
   */
  private async getJwks(kid: string | undefined): Promise<JwksGetter> {
    const unknownKid = Boolean(kid) && !this.jwksKids.has(kid!);
    const cooledDown = Date.now() - this.jwksLoadedAt > JWKS_RELOAD_COOLDOWN_MS;
    if (!this.jwks || (unknownKid && cooledDown)) {
      const jwks = await this.betterAuth.getJwks() as JSONWebKeySet;
      this.jwks = createLocalJWKSet(jwks);
      this.jwksKids = new Set(jwks.keys.map(k => k.kid).filter((k): k is string => typeof k === 'string'));
      this.jwksLoadedAt = Date.now();
    }
    return this.jwks;
  }

  private toUser(payload: JWTPayload): AuthenticatedUser {
    if (!payload.sub) throw new Error('sub claim missing');
    return {
      userId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      username: typeof payload.name === 'string' ? payload.name : undefined,
    };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      request.user = await this.verify(token);
      return true;
    }
    catch (error) {
      this.logger.debug(`토큰 검증 실패: ${error instanceof Error ? error.message : String(error)}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    const issuer = this.issuer;
    const { kid } = decodeProtectedHeader(token);
    const jwks = await this.getJwks(kid);
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: issuer });
    return this.toUser(payload);
  }

  private extractToken(request: { headers: Record<string, string | undefined> }): string | null {
    const authorization = request.headers['authorization'];
    if (!authorization) {
      return null;
    }

    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
