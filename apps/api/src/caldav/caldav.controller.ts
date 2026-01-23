import {
  Controller,
  All,
  Req,
  Res,
  Headers,
  Param,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { CaldavAuthGuard } from './guards/caldav-auth.guard';
import { CurrentDavSession } from '../carddav/decorators/dav-session.decorator';
import { CaldavService } from './caldav.service';
import type { DavSession } from '../app-tokens/app-tokens.service';
import { XMLParser } from 'fast-xml-parser';
import { Public } from '../common/decorators/public.decorator';

const UUID_REGEX = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

@Public()
@Controller()
export class CaldavController {
  private readonly logger = new Logger(CaldavController.name);
  private readonly xmlParser: XMLParser;

  constructor(private readonly caldavService: CaldavService) {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      removeNSPrefix: true,
      processEntities: false,
      htmlEntities: false,
    });
  }

  @All('.well-known/caldav')
  @UseGuards(CaldavAuthGuard)
  async wellKnown(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @CurrentDavSession() session: DavSession,
  ) {
    if (req.method === 'OPTIONS') {
      res.header('Allow', 'OPTIONS, GET, PROPFIND');
      res.header('DAV', '1, 2, 3, calendar-access');
      return res.status(HttpStatus.OK).send();
    }

    if (req.method === 'GET') {
      return res.status(301).redirect(`/caldav/principals/${session.user.id}/`);
    }

    if (req.method === 'PROPFIND') {
      const xml = this.caldavService.buildRootPropfindResponse(session);
      res.header('Content-Type', 'application/xml; charset=utf-8');
      return res.status(HttpStatus.MULTI_STATUS).send(xml);
    }

    return res.status(HttpStatus.METHOD_NOT_ALLOWED).send();
  }

  @All('caldav')
  @UseGuards(CaldavAuthGuard)
  async caldavRoot(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @CurrentDavSession() session: DavSession,
  ) {
    if (req.method === 'OPTIONS') {
      res.header('Allow', 'OPTIONS, PROPFIND');
      res.header('DAV', '1, 2, 3, calendar-access');
      return res.status(HttpStatus.OK).send();
    }

    if (req.method === 'PROPFIND') {
      const xml = this.caldavService.buildRootPropfindResponse(session);
      res.header('Content-Type', 'application/xml; charset=utf-8');
      return res.status(HttpStatus.MULTI_STATUS).send(xml);
    }

    return res.status(HttpStatus.METHOD_NOT_ALLOWED).send();
  }

  @All('caldav/principals/:userId')
  @UseGuards(CaldavAuthGuard)
  async principal(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Param('userId') userId: string,
    @Headers('depth') depth: string = '0',
    @CurrentDavSession() session: DavSession,
  ) {
    if (userId !== session.user.id) {
      return res.status(HttpStatus.FORBIDDEN).send();
    }

    if (req.method === 'OPTIONS') {
      res.header('Allow', 'OPTIONS, PROPFIND');
      res.header('DAV', '1, 2, 3, calendar-access');
      return res.status(HttpStatus.OK).send();
    }

    if (req.method === 'PROPFIND') {
      const xml = await this.caldavService.buildPrincipalPropfindResponse(session, depth);
      res.header('Content-Type', 'application/xml; charset=utf-8');
      return res.status(HttpStatus.MULTI_STATUS).send(xml);
    }

    return res.status(HttpStatus.METHOD_NOT_ALLOWED).send();
  }

  @All('caldav/principals/:userId/calendars')
  @UseGuards(CaldavAuthGuard)
  async calendarHome(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Param('userId') userId: string,
    @Headers('depth') depth: string = '0',
    @CurrentDavSession() session: DavSession,
  ) {
    if (userId !== session.user.id) {
      return res.status(HttpStatus.FORBIDDEN).send();
    }

    if (req.method === 'OPTIONS') {
      res.header('Allow', 'OPTIONS, PROPFIND');
      res.header('DAV', '1, 2, 3, calendar-access');
      return res.status(HttpStatus.OK).send();
    }

    if (req.method === 'PROPFIND') {
      const xml = await this.caldavService.buildCalendarHomePropfindResponse(session, depth);
      res.header('Content-Type', 'application/xml; charset=utf-8');
      return res.status(HttpStatus.MULTI_STATUS).send(xml);
    }

    return res.status(HttpStatus.METHOD_NOT_ALLOWED).send();
  }

  @All('caldav/principals/:userId/calendars/:calendarId')
  @UseGuards(CaldavAuthGuard)
  async dynamicCalendar(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Param('userId') userId: string,
    @Param('calendarId') calendarId: string,
    @Headers('depth') depth: string = '0',
    @CurrentDavSession() session: DavSession,
  ) {
    this.logger.debug(`dynamicCalendar - method: ${req.method}, calendarId: ${calendarId}`);

    if (userId !== session.user.id) {
      return res.status(HttpStatus.FORBIDDEN).send();
    }

    if (calendarId === 'lessons') {
      return this.handleLessonsCalendar(req, res, userId, depth, session);
    }

    if (req.method === 'MKCALENDAR') {
      this.logger.debug(`MKCALENDAR rejected for calendar: ${calendarId}`);
      return this.sendCalDavError(res, HttpStatus.FORBIDDEN, 'Calendar creation is not supported. Only the lessons calendar is available.');
    }

    if (req.method === 'OPTIONS') {
      res.header('Allow', 'OPTIONS');
      res.header('DAV', '1, 2, 3, calendar-access');
      return res.status(HttpStatus.OK).send();
    }

    return res.status(HttpStatus.NOT_FOUND).send();
  }

  @All('caldav/principals/:userId/calendars/lessons')
  @UseGuards(CaldavAuthGuard)
  async lessonsCalendar(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Param('userId') userId: string,
    @Headers('depth') depth: string = '0',
    @CurrentDavSession() session: DavSession,
  ) {
    if (userId !== session.user.id) {
      return res.status(HttpStatus.FORBIDDEN).send();
    }

    return this.handleLessonsCalendar(req, res, userId, depth, session);
  }

  private async handleLessonsCalendar(
    req: FastifyRequest,
    res: FastifyReply,
    userId: string,
    depth: string,
    session: DavSession,
  ) {
    if (req.method === 'OPTIONS') {
      res.header('Allow', 'OPTIONS, PROPFIND, REPORT');
      res.header('DAV', '1, 2, 3, calendar-access');
      return res.status(HttpStatus.OK).send();
    }

    if (req.method === 'PROPFIND') {
      const xml = await this.caldavService.buildCalendarPropfindResponse(session, depth);
      res.header('Content-Type', 'application/xml; charset=utf-8');
      return res.status(HttpStatus.MULTI_STATUS).send(xml);
    }

    if (req.method === 'REPORT') {
      return this.handleReport(req, res, session);
    }

    return res.status(HttpStatus.METHOD_NOT_ALLOWED).send();
  }

  @All('caldav/principals/:userId/calendars/lessons/:filename')
  @UseGuards(CaldavAuthGuard)
  async event(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Param('userId') userId: string,
    @Param('filename') filename: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @CurrentDavSession() session: DavSession,
  ) {
    if (userId !== session.user.id) {
      return res.status(HttpStatus.FORBIDDEN).send();
    }

    const uuid = filename.replace(/\.ics$/i, '');

    if (req.method === 'OPTIONS') {
      res.header('Allow', 'OPTIONS, GET, HEAD, PUT, PROPFIND');
      res.header('DAV', '1, 2, 3, calendar-access');
      return res.status(HttpStatus.OK).send();
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const result = await this.caldavService.getEventIcalendar(uuid, session);

      if (!result) {
        return res.status(HttpStatus.NOT_FOUND).send();
      }

      res.header('Content-Type', 'text/calendar; charset=utf-8');
      res.header('ETag', result.etag);

      if (req.method === 'HEAD') {
        return res.status(HttpStatus.OK).send();
      }

      return res.status(HttpStatus.OK).send(result.ical);
    }

    if (req.method === 'PROPFIND') {
      const result = await this.caldavService.getEventIcalendar(uuid, session);

      if (!result) {
        return res.status(HttpStatus.NOT_FOUND).send();
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/caldav/principals/${userId}/calendars/lessons/${filename}</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype/>
        <D:getetag>${result.etag}</D:getetag>
        <D:getcontenttype>text/calendar; charset=utf-8</D:getcontenttype>
        <D:current-user-privilege-set>
          <D:privilege><D:read/></D:privilege>
          <D:privilege><D:write-content/></D:privilege>
          <D:privilege><D:read-current-user-privilege-set/></D:privilege>
        </D:current-user-privilege-set>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

      res.header('Content-Type', 'application/xml; charset=utf-8');
      return res.status(HttpStatus.MULTI_STATUS).send(xml);
    }

    if (req.method === 'PUT') {
      if (ifNoneMatch === '*') {
        return this.sendCalDavError(res, HttpStatus.FORBIDDEN, 'Event creation is not supported. Events are managed through the web app.');
      }

      const rawBody = req.body as Buffer | undefined;
      const icalData = rawBody ? rawBody.toString('utf-8') : '';

      if (!icalData) {
        return res.status(HttpStatus.BAD_REQUEST).send('Request body required');
      }

      const parsed = this.caldavService.parseICalendar(icalData);
      if (!parsed) {
        return res.status(HttpStatus.BAD_REQUEST).send('Invalid iCalendar data');
      }

      const result = await this.caldavService.updateSessionFromIcalendar(
        uuid,
        session.user.id,
        parsed,
        ifMatch,
      );

      if ('error' in result) {
        switch (result.error) {
          case 'not_found':
            return res.status(HttpStatus.NOT_FOUND).send();
          case 'forbidden':
            return res.status(HttpStatus.FORBIDDEN).send();
          case 'etag_mismatch':
            return res.status(HttpStatus.PRECONDITION_FAILED).send();
        }
      }

      res.header('ETag', result.etag);
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    if (req.method === 'DELETE') {
      return this.sendCalDavError(res, HttpStatus.FORBIDDEN, 'Event deletion is not supported. Events are managed through the web app.');
    }

    return res.status(HttpStatus.METHOD_NOT_ALLOWED).send();
  }

  private sendCalDavError(res: FastifyReply, status: HttpStatus, message: string) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:error xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:description>${this.escapeXml(message)}</D:description>
</D:error>`;
    res.header('Content-Type', 'application/xml; charset=utf-8');
    return res.status(status).send(xml);
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private findElement(obj: Record<string, unknown>, localName: string): unknown {
    if (!obj || typeof obj !== 'object') return undefined;

    if (localName in obj) return obj[localName];

    for (const prefix of ['A', 'B', 'C', 'D']) {
      const key = `${prefix}:${localName}`;
      if (key in obj) return obj[key];
    }

    return undefined;
  }

  private async handleReport(req: FastifyRequest, res: FastifyReply, session: DavSession) {
    try {
      const rawBody = req.body as Buffer | undefined;
      const body = rawBody ? rawBody.toString('utf-8') : '';

      if (!body) {
        return res.status(HttpStatus.BAD_REQUEST).send();
      }

      const parsed = this.xmlParser.parse(body);

      const syncCollection = this.findElement(parsed, 'sync-collection');
      if (syncCollection && typeof syncCollection === 'object') {
        const syncToken = this.findElement(syncCollection as Record<string, unknown>, 'sync-token') as string | null;
        this.logger.debug(`sync-collection request, syncToken: ${syncToken}`);
        const xml = await this.caldavService.handleSyncCollection(session, syncToken);
        res.header('Content-Type', 'application/xml; charset=utf-8');
        return res.status(HttpStatus.MULTI_STATUS).send(xml);
      }

      const calendarQuery = this.findElement(parsed, 'calendar-query');
      if (calendarQuery && typeof calendarQuery === 'object') {
        const timeRange = this.extractTimeRange(calendarQuery as Record<string, unknown>);
        this.logger.debug(`calendar-query request, timeRange: ${JSON.stringify(timeRange)}`);
        const xml = await this.caldavService.handleCalendarQuery(session, timeRange?.start, timeRange?.end);
        res.header('Content-Type', 'application/xml; charset=utf-8');
        return res.status(HttpStatus.MULTI_STATUS).send(xml);
      }

      const multiget = this.findElement(parsed, 'calendar-multiget');
      if (multiget && typeof multiget === 'object') {
        const hrefs: string[] = [];
        const hrefNodes = this.findElement(multiget as Record<string, unknown>, 'href') || [];
        const hrefArray = Array.isArray(hrefNodes) ? hrefNodes : [hrefNodes];

        for (const href of hrefArray) {
          if (typeof href === 'string') {
            const match = href.match(/\/([^/]+)\.ics$/);
            if (match) {
              const extractedUuid = match[1];
              if (UUID_REGEX.test(extractedUuid)) {
                hrefs.push(extractedUuid);
              }
            }
          }
        }

        this.logger.debug(`calendar-multiget request, uuids count: ${hrefs.length}`);
        const xml = await this.caldavService.handleMultiget(session, hrefs);
        res.header('Content-Type', 'application/xml; charset=utf-8');
        return res.status(HttpStatus.MULTI_STATUS).send(xml);
      }

      return res.status(HttpStatus.BAD_REQUEST).send();
    }
    catch (error) {
      this.logger.error(`REPORT error: ${error}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  private extractTimeRange(calendarQuery: Record<string, unknown>): { start?: Date; end?: Date } | null {
    const filter = this.findElement(calendarQuery, 'filter') as Record<string, unknown> | undefined;
    if (!filter) return null;

    const compFilter = this.findElement(filter, 'comp-filter') as Record<string, unknown> | undefined;
    if (!compFilter) return null;

    const innerCompFilter = this.findElement(compFilter, 'comp-filter') as Record<string, unknown> | undefined;
    const targetFilter = innerCompFilter ?? compFilter;

    const timeRange = this.findElement(targetFilter, 'time-range') as Record<string, unknown> | undefined;
    if (!timeRange) return null;

    const start = timeRange['@_start'] as string | undefined;
    const end = timeRange['@_end'] as string | undefined;

    return {
      start: start ? this.parseICalDateTime(start) : undefined,
      end: end ? this.parseICalDateTime(end) : undefined,
    };
  }

  private parseICalDateTime(value: string): Date | undefined {
    try {
      const dateStr = value.trim();
      if (dateStr.endsWith('Z')) {
        const year = parseInt(dateStr.slice(0, 4), 10);
        const month = parseInt(dateStr.slice(4, 6), 10) - 1;
        const day = parseInt(dateStr.slice(6, 8), 10);
        const hours = parseInt(dateStr.slice(9, 11), 10);
        const minutes = parseInt(dateStr.slice(11, 13), 10);
        const seconds = parseInt(dateStr.slice(13, 15), 10) || 0;
        return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
      }
      return undefined;
    }
    catch {
      return undefined;
    }
  }
}
