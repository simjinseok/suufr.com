import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  username?: string;
}

type CognitoVerifier = ReturnType<typeof CognitoJwtVerifier.create<{
  userPoolId: string;
  tokenUse: 'access';
  clientId: string;
}>>;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private verifier: CognitoVerifier | null = null;

  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {}

  private getVerifier(): CognitoVerifier {
    if (!this.verifier) {
      const userPoolId = this.configService.get<string>('COGNITO_USERPOOL_ID');
      const clientId = this.configService.get<string>('COGNITO_CLIENT_ID');

      if (!userPoolId || !clientId) {
        throw new Error('COGNITO_USERPOOL_ID and COGNITO_CLIENT_ID must be provided');
      }

      this.verifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: 'access',
        clientId,
      });
    }
    return this.verifier;
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
      const verifier = this.getVerifier();
      const payload = await verifier.verify(token);
      request.user = {
        userId: payload.sub,
        email: payload.email as string | undefined,
        username: payload['cognito:username'] as string | undefined,
      } satisfies AuthenticatedUser;
      return true;
    }
    catch {
      throw new UnauthorizedException('Invalid token');
    }
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
