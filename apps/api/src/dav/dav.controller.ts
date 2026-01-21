import {
  Controller,
  Get,
  Options,
  Res,
  Req,
  UseGuards,
  Header,
  HttpCode,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Propfind } from './decorators/http-methods';
import { BasicAuthGuard } from './auth/basic-auth.guard';
import { CurrentDavSession } from './auth/dav-session.decorator';
import { DavSession } from '../app-tokens/app-tokens.service';
import { NS, DAV_CAPABILITIES, CONTENT_TYPES } from './lib/constants';
import { buildMultistatus, parsePropfind } from './lib/xml';

const DAV_HEADER = `${DAV_CAPABILITIES.LEVEL_1}, ${DAV_CAPABILITIES.LEVEL_2}, ${DAV_CAPABILITIES.LEVEL_3}, ${DAV_CAPABILITIES.CALENDAR_ACCESS}, ${DAV_CAPABILITIES.ADDRESSBOOK}`;

@Controller()
export class DavController {
  // /.well-known/caldav redirect
  @Get('.well-known/caldav')
  wellKnownCaldav(@Res() res: Response) {
    res.redirect(301, '/dav/');
  }

  // /.well-known/carddav redirect
  @Get('.well-known/carddav')
  wellKnownCarddav(@Res() res: Response) {
    res.redirect(301, '/dav/');
  }

  // OPTIONS for /dav/
  @Options('dav')
  @Options('dav/*path')
  @Header('DAV', DAV_HEADER)
  @Header('Allow', 'OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, REPORT')
  @HttpCode(200)
  davOptions() {
    return '';
  }

  // PROPFIND /dav/
  @Propfind('dav')
  @UseGuards(BasicAuthGuard)
  @Header('Content-Type', CONTENT_TYPES.XML)
  @Header('DAV', DAV_HEADER)
  @HttpCode(207)
  async propfindRoot(
    @Req() req: Request,
    @CurrentDavSession() session: DavSession,
  ) {
    const body = await this.getRawBody(req);
    const propfindRequest = parsePropfind(body);
    const userId = session.user.id;

    const props: Record<string, unknown> = {};

    // Determine which properties to return
    const requestedProps = propfindRequest.allprop
      ? [
          'resourcetype',
          'current-user-principal',
          'principal-URL',
          'displayname',
        ]
      : propfindRequest.props || [];

    for (const prop of requestedProps) {
      switch (prop) {
        case 'resourcetype':
          props['D:resourcetype'] = { 'D:collection': '' };
          break;
        case 'current-user-principal':
          props['D:current-user-principal'] = {
            'D:href': `/dav/principals/${userId}/`,
          };
          break;
        case 'principal-URL':
          props['D:principal-URL'] = {
            'D:href': `/dav/principals/${userId}/`,
          };
          break;
        case 'displayname':
          props['D:displayname'] = 'Suufr DAV';
          break;
        default:
          props[`D:${prop}`] = undefined;
      }
    }

    return buildMultistatus([
      {
        href: '/dav/',
        status: 200,
        props,
      },
    ]);
  }

  private async getRawBody(req: Request): Promise<string> {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
      });
      req.on('end', () => {
        resolve(data);
      });
      // If body already parsed or empty
      if (req.readable === false) {
        resolve((req as Request & { body?: string }).body || '');
      }
    });
  }
}
