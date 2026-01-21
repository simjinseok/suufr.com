import {
  Controller,
  UseGuards,
  Header,
  HttpCode,
  Req,
  Param,
} from '@nestjs/common';
import { Request } from 'express';
import { Propfind } from '../decorators/http-methods';
import { BasicAuthGuard } from '../auth/basic-auth.guard';
import { CurrentDavSession } from '../auth/dav-session.decorator';
import { DavSession } from '../../app-tokens/app-tokens.service';
import { CONTENT_TYPES, DAV_CAPABILITIES } from '../lib/constants';
import { buildMultistatus, parsePropfind } from '../lib/xml';

const DAV_HEADER = `${DAV_CAPABILITIES.LEVEL_1}, ${DAV_CAPABILITIES.LEVEL_2}, ${DAV_CAPABILITIES.LEVEL_3}, ${DAV_CAPABILITIES.CALENDAR_ACCESS}, ${DAV_CAPABILITIES.ADDRESSBOOK}`;

@Controller('dav/principals')
@UseGuards(BasicAuthGuard)
export class PrincipalsController {
  // PROPFIND /dav/principals/:userId/
  @Propfind(':userId')
  @Header('Content-Type', CONTENT_TYPES.XML)
  @Header('DAV', DAV_HEADER)
  @HttpCode(207)
  async propfindPrincipal(
    @Param('userId') userId: string,
    @Req() req: Request,
    @CurrentDavSession() session: DavSession,
  ) {
    const body = await this.getRawBody(req);
    const propfindRequest = parsePropfind(body);

    const props: Record<string, unknown> = {};

    // Determine which properties to return
    const requestedProps = propfindRequest.allprop
      ? [
          'resourcetype',
          'displayname',
          'calendar-home-set',
          'addressbook-home-set',
          'current-user-principal',
          'principal-URL',
        ]
      : propfindRequest.props || [];

    for (const prop of requestedProps) {
      switch (prop) {
        case 'resourcetype':
          props['D:resourcetype'] = {
            'D:collection': '',
            'D:principal': '',
          };
          break;
        case 'displayname':
          props['D:displayname'] = session.user.email;
          break;
        case 'calendar-home-set':
          props['C:calendar-home-set'] = {
            'D:href': `/dav/calendars/${userId}/`,
          };
          break;
        case 'addressbook-home-set':
          props['CARD:addressbook-home-set'] = {
            'D:href': `/dav/addressbooks/${userId}/`,
          };
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
        default:
          props[`D:${prop}`] = undefined;
      }
    }

    return buildMultistatus([
      {
        href: `/dav/principals/${userId}/`,
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
