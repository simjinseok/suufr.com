import { RequestMapping, RequestMethod } from '@nestjs/common';

// NestJS doesn't support WebDAV methods natively, so we create custom decorators
// Using 'as unknown as RequestMethod' to bypass TypeScript's strict enum checking

export const Propfind = (path?: string) =>
  RequestMapping({ path, method: 'PROPFIND' as unknown as RequestMethod });

export const Report = (path?: string) =>
  RequestMapping({ path, method: 'REPORT' as unknown as RequestMethod });

export const Mkcol = (path?: string) =>
  RequestMapping({ path, method: 'MKCOL' as unknown as RequestMethod });

export const Copy = (path?: string) =>
  RequestMapping({ path, method: 'COPY' as unknown as RequestMethod });

export const Move = (path?: string) =>
  RequestMapping({ path, method: 'MOVE' as unknown as RequestMethod });

export const Proppatch = (path?: string) =>
  RequestMapping({ path, method: 'PROPPATCH' as unknown as RequestMethod });
