import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { DavSession } from '../../app-tokens/app-tokens.service';

export const CurrentDavSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DavSession | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.davSession as DavSession | undefined;
  },
);
