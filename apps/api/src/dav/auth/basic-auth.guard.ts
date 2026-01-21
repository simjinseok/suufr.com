import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AppTokensService, DavSession } from '../../app-tokens/app-tokens.service';
import { Request, Response } from 'express';

export const DAV_SESSION_KEY = 'davSession';

function parseBasicAuth(header: string | null): { email: string; password: string } | null {
  if (!header || !header.startsWith('Basic ')) {
    return null;
  }

  try {
    const base64 = header.slice(6);
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      return null;
    }

    return {
      email: decoded.slice(0, colonIndex),
      password: decoded.slice(colonIndex + 1),
    };
  }
  catch {
    return null;
  }
}

@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(private readonly appTokensService: AppTokensService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const authHeader = request.headers.authorization || null;
    const credentials = parseBasicAuth(authHeader);

    if (!credentials) {
      response.setHeader('WWW-Authenticate', 'Basic realm="Suufr DAV"');
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const { email, password: token } = credentials;
    const session = await this.appTokensService.validateToken(email, token);

    if (!session) {
      response.setHeader('WWW-Authenticate', 'Basic realm="Suufr DAV"');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify that the userId in the URL matches the authenticated user
    const userIdParam = request.params.userId;
    if (userIdParam && userIdParam !== session.user.id) {
      throw new UnauthorizedException('User mismatch');
    }

    // Attach session to request
    (request as Request & { [DAV_SESSION_KEY]: DavSession })[DAV_SESSION_KEY] = session;

    return true;
  }
}
