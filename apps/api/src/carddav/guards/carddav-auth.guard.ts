import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import * as Sentry from '@sentry/nestjs';
import { AppTokensService } from '../../app-tokens/app-tokens.service';

// 더 엄격한 이메일 검증 정규식
// - 로컬 파트: 알파벳, 숫자, 점, 하이픈, 밑줄 허용 (연속 점 불가)
// - 도메인: 알파벳, 숫자, 하이픈 허용, 최소 2자 TLD
const EMAIL_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;

@Injectable()
export class CarddavAuthGuard implements CanActivate {
  constructor(private readonly appTokensService: AppTokensService) {}

  private isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email) && email.length <= 254;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      // Request authentication
      Sentry.addBreadcrumb({
        category: 'carddav.auth',
        message: 'Authentication required - no header',
        level: 'info',
      });
      response.header('WWW-Authenticate', 'Basic realm="CardDAV"');
      throw new UnauthorizedException('Authentication required');
    }

    if (!authHeader.startsWith('Basic ')) {
      Sentry.addBreadcrumb({
        category: 'carddav.auth',
        message: 'Authentication failed - not Basic auth',
        level: 'warning',
      });
      response.header('WWW-Authenticate', 'Basic realm="CardDAV"');
      throw new UnauthorizedException('Basic authentication required');
    }

    const base64Credentials = authHeader.slice(6);
    let credentials: string;
    try {
      credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    }
    catch {
      Sentry.addBreadcrumb({
        category: 'carddav.auth',
        message: 'Authentication failed - invalid base64 encoding',
        level: 'warning',
      });
      throw new UnauthorizedException('Invalid credentials encoding');
    }

    const [email, token] = credentials.split(':');

    if (!email || !token) {
      Sentry.addBreadcrumb({
        category: 'carddav.auth',
        message: 'Authentication failed - invalid format',
        level: 'warning',
      });
      throw new UnauthorizedException('Invalid credentials format');
    }

    // Validate email format before database lookup
    if (!this.isValidEmail(email)) {
      Sentry.addBreadcrumb({
        category: 'carddav.auth',
        message: 'Authentication failed - invalid email format',
        level: 'warning',
        data: { email },
      });
      response.header('WWW-Authenticate', 'Basic realm="CardDAV"');
      throw new UnauthorizedException('Invalid email format');
    }

    const davSession = await this.appTokensService.validateToken(email, token);

    if (!davSession) {
      Sentry.addBreadcrumb({
        category: 'carddav.auth',
        message: 'Authentication failed - invalid token',
        level: 'warning',
        data: { email },
      });
      response.header('WWW-Authenticate', 'Basic realm="CardDAV"');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Attach the session to the request
    request.davSession = davSession;

    return true;
  }
}
