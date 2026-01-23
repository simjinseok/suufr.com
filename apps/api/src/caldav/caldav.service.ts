import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DavSession } from '../app-tokens/app-tokens.service';
import { ICalendarService, SessionEvent, ParsedICalendarEvent } from './services/icalendar.service';
import { CaldavXmlBuilderService } from './services/caldav-xml-builder.service';
import { generateEtag, generateCtag } from '../carddav/utils/etag.util';

/**
 * Sync token format: data:,{timestamp}
 * @see RFC 6578 (WebDAV Sync) - sync-token must be a valid URI
 */
function generateSyncToken(date: Date | null): string {
  const timestamp = date ? date.getTime() : 0;
  return `data:,${timestamp}`;
}

function parseSyncToken(token: string): Date | null {
  if (!token || !token.startsWith('data:,')) {
    return null;
  }
  const timestamp = parseInt(token.slice(6), 10);
  if (isNaN(timestamp) || timestamp === 0) {
    return null;
  }
  return new Date(timestamp);
}

@Injectable()
export class CaldavService {
  private readonly logger = new Logger(CaldavService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly icalendarService: ICalendarService,
    private readonly xmlBuilderService: CaldavXmlBuilderService,
  ) {}

  async getSessions(userId: string, startDate?: Date, endDate?: Date): Promise<SessionEvent[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        deletedAt: null,
        lesson: {
          deletedAt: null,
          student: {
            userId,
            deletedAt: null,
          },
        },
        ...(startDate && { sessionAt: { gte: startDate } }),
        ...(endDate && { sessionAt: { lte: endDate } }),
      },
      include: {
        lesson: {
          include: {
            student: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { sessionAt: 'desc' },
    });

    return sessions.map(s => ({
      uuid: s.uuid,
      sessionAt: s.sessionAt,
      duration: s.duration,
      lessonTitle: s.lesson.title,
      studentName: s.lesson.student.name,
      notes: s.notes,
      isDone: s.isDone,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
    }));
  }

  async getSession(uuid: string, userId: string): Promise<SessionEvent | null> {
    const session = await this.prisma.session.findFirst({
      where: {
        uuid,
        deletedAt: null,
        lesson: {
          deletedAt: null,
          student: {
            userId,
            deletedAt: null,
          },
        },
      },
      include: {
        lesson: {
          include: {
            student: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    return {
      uuid: session.uuid,
      sessionAt: session.sessionAt,
      duration: session.duration,
      lessonTitle: session.lesson.title,
      studentName: session.lesson.student.name,
      notes: session.notes,
      isDone: session.isDone,
      updatedAt: session.updatedAt,
      createdAt: session.createdAt,
    };
  }

  async getLatestUpdatedAt(userId: string): Promise<Date | null> {
    const latest = await this.prisma.session.findFirst({
      where: {
        deletedAt: null,
        lesson: {
          deletedAt: null,
          student: {
            userId,
            deletedAt: null,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    return latest?.updatedAt ?? null;
  }

  buildRootPropfindResponse(session: DavSession): string {
    const userId = session.user.id;

    return this.xmlBuilderService.buildMultistatus([
      {
        href: '/caldav/',
        status: 200,
        properties: [
          { name: 'resourcetype', children: [{ name: 'collection' }] },
          {
            name: 'current-user-principal',
            children: [
              { name: 'href', value: `/caldav/principals/${userId}/` },
            ],
          },
        ],
      },
    ]);
  }

  async buildPrincipalPropfindResponse(session: DavSession, depth: string): Promise<string> {
    const userId = session.user.id;
    const displayName = session.organization.name;

    const responses = [
      {
        href: `/caldav/principals/${userId}/`,
        status: 200,
        properties: this.xmlBuilderService.buildPrincipalProps(userId, displayName),
      },
    ];

    if (depth === '1') {
      responses.push({
        href: `/caldav/principals/${userId}/calendars/`,
        status: 200,
        properties: this.xmlBuilderService.buildCalendarHomeProps(userId),
      });
    }

    return this.xmlBuilderService.buildMultistatus(responses);
  }

  async buildCalendarHomePropfindResponse(session: DavSession, depth: string): Promise<string> {
    const userId = session.user.id;

    const responses = [
      {
        href: `/caldav/principals/${userId}/calendars/`,
        status: 200,
        properties: this.xmlBuilderService.buildCalendarHomeProps(userId),
      },
    ];

    if (depth === '1') {
      const latestUpdatedAt = await this.getLatestUpdatedAt(userId);
      const ctag = generateCtag(latestUpdatedAt);
      const syncToken = generateSyncToken(latestUpdatedAt);
      responses.push({
        href: `/caldav/principals/${userId}/calendars/lessons/`,
        status: 200,
        properties: this.xmlBuilderService.buildCalendarProps(userId, `${session.organization.name} 수업`, ctag, syncToken),
      });
    }

    return this.xmlBuilderService.buildMultistatus(responses);
  }

  async buildCalendarPropfindResponse(session: DavSession, depth: string): Promise<string> {
    const userId = session.user.id;
    const displayName = `${session.organization.name} 수업`;
    const latestUpdatedAt = await this.getLatestUpdatedAt(userId);
    const ctag = generateCtag(latestUpdatedAt);
    const syncToken = generateSyncToken(latestUpdatedAt);
    this.logger.debug(`PROPFIND lessons calendar - ctag: ${ctag}`);

    const responses = [
      {
        href: `/caldav/principals/${userId}/calendars/lessons/`,
        status: 200,
        properties: this.xmlBuilderService.buildCalendarProps(userId, displayName, ctag, syncToken),
      },
    ];

    if (depth === '1') {
      const sessions = await this.getSessions(userId);

      for (const s of sessions) {
        const etag = generateEtag(s.uuid, s.updatedAt);
        responses.push({
          href: `/caldav/principals/${userId}/calendars/lessons/${s.uuid}.ics`,
          status: 200,
          properties: this.xmlBuilderService.buildEventProps(
            `/caldav/principals/${userId}/calendars/lessons/${s.uuid}.ics`,
            etag,
            s.updatedAt,
            s.createdAt,
          ),
        });
      }
    }

    return this.xmlBuilderService.buildMultistatus(responses);
  }

  async getEventIcalendar(uuid: string, session: DavSession): Promise<{ ical: string; etag: string } | null> {
    const sessionEvent = await this.getSession(uuid, session.user.id);

    if (!sessionEvent) {
      return null;
    }

    const vevent = this.icalendarService.sessionToVevent(sessionEvent);
    const ical = this.icalendarService.wrapVcalendar([vevent]);
    const etag = generateEtag(sessionEvent.uuid, sessionEvent.updatedAt);

    return { ical, etag };
  }

  async handleMultiget(session: DavSession, uuids: string[]): Promise<string> {
    const userId = session.user.id;

    const sessions = await this.prisma.session.findMany({
      where: {
        uuid: { in: uuids },
        deletedAt: null,
        lesson: {
          deletedAt: null,
          student: {
            userId,
            deletedAt: null,
          },
        },
      },
      include: {
        lesson: {
          include: {
            student: {
              select: { name: true },
            },
          },
        },
      },
    });

    const events = sessions.map((s) => {
      const sessionEvent: SessionEvent = {
        uuid: s.uuid,
        sessionAt: s.sessionAt,
        duration: s.duration,
        lessonTitle: s.lesson.title,
        studentName: s.lesson.student.name,
        notes: s.notes,
        isDone: s.isDone,
        updatedAt: s.updatedAt,
        createdAt: s.createdAt,
      };
      const vevent = this.icalendarService.sessionToVevent(sessionEvent);
      const ical = this.icalendarService.wrapVcalendar([vevent]);
      const etag = generateEtag(s.uuid, s.updatedAt);
      return {
        href: `/caldav/principals/${userId}/calendars/lessons/${s.uuid}.ics`,
        etag,
        updatedAt: s.updatedAt,
        createdAt: s.createdAt,
        icalData: ical,
      };
    });

    return this.xmlBuilderService.buildMultigetResponse(events);
  }

  async handleCalendarQuery(session: DavSession, startDate?: Date, endDate?: Date): Promise<string> {
    const userId = session.user.id;
    const sessions = await this.getSessions(userId, startDate, endDate);

    const events = sessions.map((s) => {
      const vevent = this.icalendarService.sessionToVevent(s);
      const ical = this.icalendarService.wrapVcalendar([vevent]);
      const etag = generateEtag(s.uuid, s.updatedAt);
      return {
        href: `/caldav/principals/${userId}/calendars/lessons/${s.uuid}.ics`,
        etag,
        updatedAt: s.updatedAt,
        createdAt: s.createdAt,
        icalData: ical,
      };
    });

    return this.xmlBuilderService.buildMultigetResponse(events);
  }

  async handleSyncCollection(session: DavSession, syncToken: string | null): Promise<string> {
    const userId = session.user.id;
    const sinceDate = syncToken ? parseSyncToken(syncToken) : null;

    const changedSessions = await this.prisma.session.findMany({
      where: {
        deletedAt: null,
        lesson: {
          deletedAt: null,
          student: {
            userId,
            deletedAt: null,
          },
        },
        ...(sinceDate && { updatedAt: { gt: sinceDate } }),
      },
      select: {
        uuid: true,
        updatedAt: true,
      },
    });

    const deletedSessions = sinceDate
      ? await this.prisma.session.findMany({
          where: {
            deletedAt: { gt: sinceDate },
            lesson: {
              student: {
                userId,
              },
            },
          },
          select: {
            uuid: true,
          },
        })
      : [];

    const changed = changedSessions.map(s => ({
      href: `/caldav/principals/${userId}/calendars/lessons/${s.uuid}.ics`,
      etag: generateEtag(s.uuid, s.updatedAt),
    }));

    const deleted = deletedSessions.map(s =>
      `/caldav/principals/${userId}/calendars/lessons/${s.uuid}.ics`,
    );

    const newSyncToken = generateSyncToken(new Date());

    return this.xmlBuilderService.buildSyncCollectionResponse(changed, deleted, newSyncToken);
  }

  parseICalendar(icalData: string): ParsedICalendarEvent | null {
    return this.icalendarService.parseICalendar(icalData);
  }

  async updateSessionFromIcalendar(
    uuid: string,
    userId: string,
    parsed: ParsedICalendarEvent,
    expectedEtag?: string,
  ): Promise<
    | { session: SessionEvent; etag: string }
    | { error: 'not_found' | 'etag_mismatch' | 'forbidden' }
  > {
    const session = await this.prisma.session.findFirst({
      where: {
        uuid,
        deletedAt: null,
        lesson: {
          deletedAt: null,
          student: {
            userId,
            deletedAt: null,
          },
        },
      },
      include: {
        lesson: {
          include: {
            student: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!session) {
      return { error: 'not_found' };
    }

    if (expectedEtag) {
      const currentEtag = generateEtag(session.uuid, session.updatedAt);
      if (currentEtag !== expectedEtag) {
        return { error: 'etag_mismatch' };
      }
    }

    const updateData: { notes?: string; sessionAt?: Date; duration?: number } = {};

    if (parsed.description !== undefined) {
      updateData.notes = parsed.description ?? '';
    }

    if (parsed.dtstart) {
      updateData.sessionAt = parsed.dtstart;
    }

    if (parsed.dtstart && parsed.dtend) {
      const durationMs = parsed.dtend.getTime() - parsed.dtstart.getTime();
      const durationMinutes = Math.round(durationMs / (60 * 1000));
      if (durationMinutes > 0) {
        updateData.duration = durationMinutes;
      }
    }

    this.logger.debug(`updateSessionFromIcalendar - updateData: ${JSON.stringify(updateData)}`);

    const updatedSession = await this.prisma.session.update({
      where: { id: session.id },
      data: updateData,
      include: {
        lesson: {
          include: {
            student: {
              select: { name: true },
            },
          },
        },
      },
    });

    const result: SessionEvent = {
      uuid: updatedSession.uuid,
      sessionAt: updatedSession.sessionAt,
      duration: updatedSession.duration,
      lessonTitle: updatedSession.lesson.title,
      studentName: updatedSession.lesson.student.name,
      notes: updatedSession.notes,
      isDone: updatedSession.isDone,
      updatedAt: updatedSession.updatedAt,
      createdAt: updatedSession.createdAt,
    };

    return {
      session: result,
      etag: generateEtag(result.uuid, result.updatedAt),
    };
  }
}
