import {
  Controller,
  UseGuards,
  Header,
  HttpCode,
  Req,
  Res,
  Param,
  Get,
  Put,
  Delete,
  NotFoundException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Propfind, Report } from '../decorators/http-methods';
import { BasicAuthGuard } from '../auth/basic-auth.guard';
import { CurrentDavSession } from '../auth/dav-session.decorator';
import { DavSession } from '../../app-tokens/app-tokens.service';
import { CaldavService } from './caldav.service';
import { CONTENT_TYPES, DAV_CAPABILITIES } from '../lib/constants';
import { buildMultistatus, parsePropfind, parseReport } from '../lib/xml';
import { compareEtag } from '../lib/etag';

const DAV_HEADER = `${DAV_CAPABILITIES.LEVEL_1}, ${DAV_CAPABILITIES.LEVEL_2}, ${DAV_CAPABILITIES.LEVEL_3}, ${DAV_CAPABILITIES.CALENDAR_ACCESS}`;

@Controller('dav/calendars')
@UseGuards(BasicAuthGuard)
export class CaldavController {
  constructor(private readonly caldavService: CaldavService) {}

  // PROPFIND /dav/calendars/:userId/
  @Propfind(':userId')
  @Header('Content-Type', CONTENT_TYPES.XML)
  @Header('DAV', DAV_HEADER)
  @HttpCode(207)
  async propfindCalendarHome(
    @Param('userId') userId: string,
    @Req() req: Request,
    @CurrentDavSession() session: DavSession,
  ) {
    const body = await this.getRawBody(req);
    const propfindRequest = parsePropfind(body);
    const depth = req.headers['depth'] || '1';

    const responses = [];

    // Calendar home collection
    const homeProps: Record<string, unknown> = {};
    const requestedProps = propfindRequest.allprop
      ? ['resourcetype', 'displayname', 'current-user-principal']
      : propfindRequest.props || [];

    for (const prop of requestedProps) {
      switch (prop) {
        case 'resourcetype':
          homeProps['D:resourcetype'] = { 'D:collection': '' };
          break;
        case 'displayname':
          homeProps['D:displayname'] = 'Calendars';
          break;
        case 'current-user-principal':
          homeProps['D:current-user-principal'] = {
            'D:href': `/dav/principals/${userId}/`,
          };
          break;
        default:
          homeProps[`D:${prop}`] = undefined;
      }
    }

    responses.push({
      href: `/dav/calendars/${userId}/`,
      status: 200,
      props: homeProps,
    });

    // Include default calendar if depth > 0
    if (depth !== '0') {
      const calendarProps: Record<string, unknown> = {};
      for (const prop of requestedProps) {
        switch (prop) {
          case 'resourcetype':
            calendarProps['D:resourcetype'] = {
              'D:collection': '',
              'C:calendar': '',
            };
            break;
          case 'displayname':
            calendarProps['D:displayname'] = session.organization.name;
            break;
          case 'calendar-description':
            calendarProps['C:calendar-description'] = `${session.organization.name} 수업 일정`;
            break;
          case 'supported-calendar-component-set':
            calendarProps['C:supported-calendar-component-set'] = {
              'C:comp': { '@_name': 'VEVENT' },
            };
            break;
          case 'getctag':
          case 'CS:getctag':
            // Calendar sync token - use current timestamp for simplicity
            calendarProps['CS:getctag'] = `ctag-${Date.now()}`;
            break;
          default:
            calendarProps[`D:${prop}`] = undefined;
        }
      }

      responses.push({
        href: `/dav/calendars/${userId}/default/`,
        status: 200,
        props: calendarProps,
      });
    }

    return buildMultistatus(responses);
  }

  // PROPFIND /dav/calendars/:userId/default/
  @Propfind(':userId/default')
  @Header('Content-Type', CONTENT_TYPES.XML)
  @Header('DAV', DAV_HEADER)
  @HttpCode(207)
  async propfindCalendar(
    @Param('userId') userId: string,
    @Req() req: Request,
    @CurrentDavSession() session: DavSession,
  ) {
    const body = await this.getRawBody(req);
    const propfindRequest = parsePropfind(body);
    const depth = req.headers['depth'] || '1';

    const responses = [];

    // Calendar collection
    const calendarProps: Record<string, unknown> = {};
    const requestedProps = propfindRequest.allprop
      ? [
          'resourcetype',
          'displayname',
          'calendar-description',
          'supported-calendar-component-set',
          'getctag',
        ]
      : propfindRequest.props || [];

    for (const prop of requestedProps) {
      switch (prop) {
        case 'resourcetype':
          calendarProps['D:resourcetype'] = {
            'D:collection': '',
            'C:calendar': '',
          };
          break;
        case 'displayname':
          calendarProps['D:displayname'] = session.organization.name;
          break;
        case 'calendar-description':
          calendarProps['C:calendar-description'] = `${session.organization.name} 수업 일정`;
          break;
        case 'supported-calendar-component-set':
          calendarProps['C:supported-calendar-component-set'] = {
            'C:comp': { '@_name': 'VEVENT' },
          };
          break;
        case 'getctag':
        case 'CS:getctag':
          calendarProps['CS:getctag'] = `ctag-${Date.now()}`;
          break;
        default:
          calendarProps[`D:${prop}`] = undefined;
      }
    }

    responses.push({
      href: `/dav/calendars/${userId}/default/`,
      status: 200,
      props: calendarProps,
    });

    // Include events if depth > 0
    if (depth !== '0') {
      const sessions = await this.caldavService.findAllSessions(
        userId,
        session.organization.id,
      );

      for (const sess of sessions) {
        const eventProps: Record<string, unknown> = {};
        for (const prop of requestedProps) {
          switch (prop) {
            case 'resourcetype':
              eventProps['D:resourcetype'] = '';
              break;
            case 'getetag':
              eventProps['D:getetag'] = this.caldavService.generateEtag(sess);
              break;
            case 'getcontenttype':
              eventProps['D:getcontenttype'] = CONTENT_TYPES.CALENDAR;
              break;
            default:
              eventProps[`D:${prop}`] = undefined;
          }
        }

        responses.push({
          href: `/dav/calendars/${userId}/default/${sess.uuid}.ics`,
          status: 200,
          props: eventProps,
        });
      }
    }

    return buildMultistatus(responses);
  }

  // REPORT /dav/calendars/:userId/default/
  @Report(':userId/default')
  @Header('Content-Type', CONTENT_TYPES.XML)
  @Header('DAV', DAV_HEADER)
  @HttpCode(207)
  async reportCalendar(
    @Param('userId') userId: string,
    @Req() req: Request,
    @CurrentDavSession() session: DavSession,
  ) {
    const body = await this.getRawBody(req);
    const reportRequest = parseReport(body);

    let sessions;

    if (reportRequest.type === 'calendar-multiget' && reportRequest.hrefs) {
      // Extract UUIDs from hrefs
      const uuids = reportRequest.hrefs
        .map((href) => {
          const match = href.match(/([a-f0-9-]+)\.ics$/);
          return match ? match[1] : null;
        })
        .filter((uuid): uuid is string => uuid !== null);

      sessions = await this.caldavService.findSessionsByUuids(
        uuids,
        userId,
        session.organization.id,
      );
    }
    else {
      // calendar-query: return all events
      sessions = await this.caldavService.findAllSessions(
        userId,
        session.organization.id,
      );
    }

    const responses = sessions.map((sess) => {
      const props: Record<string, unknown> = {};

      for (const prop of reportRequest.props || []) {
        switch (prop) {
          case 'getetag':
            props['D:getetag'] = this.caldavService.generateEtag(sess);
            break;
          case 'calendar-data':
            props['C:calendar-data'] = this.caldavService.sessionToIcal(sess);
            break;
          default:
            props[`D:${prop}`] = undefined;
        }
      }

      return {
        href: `/dav/calendars/${userId}/default/${sess.uuid}.ics`,
        status: 200,
        props,
      };
    });

    return buildMultistatus(responses);
  }

  // GET /dav/calendars/:userId/default/:uid.ics
  @Get(':userId/default/:uid.ics')
  @Header('Content-Type', CONTENT_TYPES.CALENDAR)
  async getEvent(
    @Param('userId') userId: string,
    @Param('uid') uid: string,
    @Res() res: Response,
    @CurrentDavSession() session: DavSession,
  ) {
    const sess = await this.caldavService.findSessionByUuid(
      uid,
      userId,
      session.organization.id,
    );

    if (!sess) {
      throw new NotFoundException('Event not found');
    }

    const ical = this.caldavService.sessionToIcal(sess);
    const etag = this.caldavService.generateEtag(sess);

    res.setHeader('ETag', etag);
    res.send(ical);
  }

  // PUT /dav/calendars/:userId/default/:uid.ics
  @Put(':userId/default/:uid.ics')
  async putEvent(
    @Param('userId') userId: string,
    @Param('uid') uid: string,
    @Req() req: Request,
    @Res() res: Response,
    @CurrentDavSession() session: DavSession,
  ) {
    const ifMatch = req.headers['if-match'] as string | undefined;
    const body = await this.getRawBody(req);

    const existing = await this.caldavService.findSessionByUuid(
      uid,
      userId,
      session.organization.id,
    );

    if (existing) {
      // Update existing event
      if (ifMatch) {
        const currentEtag = this.caldavService.generateEtag(existing);
        if (!compareEtag(ifMatch, currentEtag)) {
          res.status(HttpStatus.PRECONDITION_FAILED).send('ETag mismatch');
          return;
        }
      }

      const updated = await this.caldavService.updateSession(
        uid,
        userId,
        session.organization.id,
        body,
      );

      if (updated) {
        const etag = this.caldavService.generateEtag(updated);
        res.setHeader('ETag', etag);
        res.status(HttpStatus.NO_CONTENT).send();
      }
      else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to update');
      }
    }
    else {
      // New event creation is not supported (sessions are created through the app)
      res.status(HttpStatus.FORBIDDEN).send('Creating new events is not supported');
    }
  }

  // DELETE /dav/calendars/:userId/default/:uid.ics
  @Delete(':userId/default/:uid.ics')
  async deleteEvent(
    @Param('userId') userId: string,
    @Param('uid') uid: string,
    @Res() res: Response,
    @CurrentDavSession() session: DavSession,
  ) {
    // Deleting events is not supported (sessions should be managed through the app)
    res.status(HttpStatus.FORBIDDEN).send('Deleting events is not supported');
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
