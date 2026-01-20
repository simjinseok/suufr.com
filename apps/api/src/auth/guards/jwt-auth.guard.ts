import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 개발 환경 우회: X-Dev-User-Id 헤더 사용
    if (process.env.NODE_ENV !== 'production') {
      const request = context.switchToHttp().getRequest();
      const devUserId = request.headers['x-dev-user-id'];

      if (devUserId) {
        request.user = {
          userId: devUserId,
          email: 'dev@test.com',
          username: 'dev-user',
        };
        return true;
      }
    }

    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser, _info: Error | null): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
