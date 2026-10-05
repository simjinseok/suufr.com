import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { createLocalJWKSet, decodeProtectedHeader, jwtVerify, type JSONWebKeySet, type JWTPayload } from 'jose';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { BetterAuthService } from '../better-auth/better-auth.service';

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  /** 표시 이름. Cognito 토큰에서는 cognito:username(=sub), better-auth JWT 에서는 user.name */
  username?: string;
}

type CognitoVerifier = ReturnType<typeof CognitoJwtVerifier.create<{
  userPoolId: string;
  tokenUse: 'access';
  clientId: string;
}>>;

type JwksGetter = ReturnType<typeof createLocalJWKSet>;

/** 서명 검증 없이 iss 만 읽어 발급자를 가른다 (검증은 각 경로에서 한다) */
export function peekIssuer(token: string): string | undefined {
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as { iss?: unknown };
    return typeof payload.iss === 'string' ? payload.iss : undefined;
  }
  catch {
    return undefined;
  }
}

/**
 * 전역 가드. Authorization: Bearer <JWT> 를 검증해 request.user 를 주입한다.
 * - iss 가 BETTER_AUTH_URL 이면 better-auth JWT 플러그인 토큰 → jose + JWKS(DB, 프로세스 캐시) 로컬 검증
 * - 그 외(Cognito 유저풀 issuer)는 AUTH_ACCEPT_COGNITO_TOKENS(기본 true) 일 때 aws-jwt-verify 로 검증 (Phase 6 에서 종료)
 * 두 경로 모두 같은 AuthenticatedUser 모양을 만들어 @CurrentUser() 사용처는 바뀌지 않는다.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private cognitoVerifier: CognitoVerifier | null = null;
  private jwks: JwksGetter | null = null;
  private jwksKids = new Set<string>();

  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
    @Optional() @Inject(BetterAuthService) private betterAuth?: BetterAuthService,
  ) {}

  private get betterAuthIssuer(): string | undefined {
    return this.configService.get<string>('BETTER_AUTH_URL');
  }

  private get acceptCognitoTokens(): boolean {
    return (this.configService.get<string>('AUTH_ACCEPT_COGNITO_TOKENS') ?? 'true') !== 'false';
  }

  private getCognitoVerifier(): CognitoVerifier {
    if (!this.cognitoVerifier) {
      const userPoolId = this.configService.get<string>('COGNITO_USERPOOL_ID');
      const clientId = this.configService.get<string>('COGNITO_CLIENT_ID');

      if (!userPoolId || !clientId) {
        throw new Error('COGNITO_USERPOOL_ID and COGNITO_CLIENT_ID must be provided');
      }

      this.cognitoVerifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: 'access',
        clientId,
      });
    }
    return this.cognitoVerifier;
  }

  /** JWKS 는 거의 바뀌지 않으므로 프로세스에 캐시하고, 모르는 kid 가 오면 1회 다시 읽는다 */
  private async getJwks(kid: string | undefined): Promise<JwksGetter> {
    if (!this.betterAuth) throw new Error('BetterAuthService is not available');
    if (!this.jwks || (kid && !this.jwksKids.has(kid))) {
      const jwks = await this.betterAuth.getJwks() as JSONWebKeySet;
      this.jwks = createLocalJWKSet(jwks);
      this.jwksKids = new Set(jwks.keys.map(k => k.kid).filter((k): k is string => typeof k === 'string'));
    }
    return this.jwks;
  }

  private async verifyBetterAuthToken(token: string, issuer: string): Promise<AuthenticatedUser> {
    const { kid } = decodeProtectedHeader(token);
    const jwks = await this.getJwks(kid);
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: issuer });
    return this.toUserFromBetterAuth(payload);
  }

  private toUserFromBetterAuth(payload: JWTPayload): AuthenticatedUser {
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
    const issuer = peekIssuer(token);
    const betterAuthIssuer = this.betterAuthIssuer;

    if (betterAuthIssuer && issuer === betterAuthIssuer) {
      return this.verifyBetterAuthToken(token, betterAuthIssuer);
    }

    if (!this.acceptCognitoTokens) {
      throw new Error('Cognito tokens are no longer accepted');
    }

    const payload = await this.getCognitoVerifier().verify(token);
    return {
      userId: payload.sub,
      email: payload.email as string | undefined,
      username: payload['cognito:username'] as string | undefined,
    } satisfies AuthenticatedUser;
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
