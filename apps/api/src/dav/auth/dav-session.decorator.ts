import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DAV_SESSION_KEY } from './basic-auth.guard';
import { DavSession } from '../../app-tokens/app-tokens.service';

export const CurrentDavSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DavSession => {
    const request = ctx.switchToHttp().getRequest();
    return request[DAV_SESSION_KEY];
  },
);
