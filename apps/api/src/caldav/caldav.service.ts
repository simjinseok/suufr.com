import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DavSession } from '../app-tokens/app-tokens.service';
import { ICalendarService, SessionEvent, ParsedICalendarEvent } from './services/icalendar.service';
import { CaldavXmlBuilderService } from './services/caldav-xml-builder.service';
import { generateEtag, generateCtag } from '../carddav/utils/etag.util';

/**
 * Get the effective updatedAt by taking the max of session, lesson, and student updatedAt
 */
function getEffectiveUpdatedAt(session: SessionEvent): Date {
  return new Date(Math.max(
    session.updatedAt.getTime(),
    session.lessonUpdatedAt.getTime(),
    session.studentUpdatedAt.getTime(),
  ));
}

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
          select: {
            title: true,
            updatedAt: true,
            student: {
              select: {
                name: true,
                uuid: true,
                email: true,
                updatedAt: true,
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
      studentUuid: s.lesson.student.uuid,
      studentEmail: s.lesson.student.email ?? undefined,
      userId,
      notes: s.notes,
      isDone: s.isDone,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
      lessonUpdatedAt: s.lesson.updatedAt,
      studentUpdatedAt: s.lesson.student.updatedAt,
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
          select: {
            title: true,
            updatedAt: true,
            student: {
              select: {
                name: true,
                uuid: true,
                email: true,
                updatedAt: true,
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
      studentUuid: session.lesson.student.uuid,
      studentEmail: session.lesson.student.email ?? undefined,
      userId,
      notes: session.notes,
      isDone: session.isDone,
      updatedAt: session.updatedAt,
      createdAt: session.createdAt,
      lessonUpdatedAt: session.lesson.updatedAt,
      studentUpdatedAt: session.lesson.student.updatedAt,
    };
  }

  async getLatestUpdatedAt(userId: string): Promise<Date | null> {
    const [latestSession, latestLesson, latestStudent] = await Promise.all([
      this.prisma.session.findFirst({
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
      }),
      this.prisma.lesson.findFirst({
        where: {
          deletedAt: null,
          student: {
            userId,
            deletedAt: null,
          },
        },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      this.prisma.student.findFirst({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    const dates = [
      latestSession?.updatedAt,
      latestLesson?.updatedAt,
      latestStudent?.updatedAt,
    ].filter((d): d is Date => d !== null && d !== undefined);

    if (dates.length === 0) return null;
    return new Date(Math.max(...dates.map(d => d.getTime())));
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
        properties: this.xmlBuilderService.buildCalendarProps(userId, '스프 수업', ctag, syncToken),
      });
    }

    return this.xmlBuilderService.buildMultistatus(responses);
  }

  async buildCalendarPropfindResponse(session: DavSession, depth: string): Promise<string> {
    const userId = session.user.id;
    const displayName = '스프 수업';
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
        const effectiveUpdatedAt = getEffectiveUpdatedAt(s);
        const etag = generateEtag(s.uuid, effectiveUpdatedAt);
        responses.push({
          href: `/caldav/principals/${userId}/calendars/lessons/${s.uuid}.ics`,
          status: 200,
          properties: this.xmlBuilderService.buildEventProps(
            `/caldav/principals/${userId}/calendars/lessons/${s.uuid}.ics`,
            etag,
            effectiveUpdatedAt,
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
    const etag = generateEtag(sessionEvent.uuid, getEffectiveUpdatedAt(sessionEvent));

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
          select: {
            title: true,
            updatedAt: true,
            student: {
              select: { name: true, uuid: true, email: true, updatedAt: true },
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
        studentUuid: s.lesson.student.uuid,
        studentEmail: s.lesson.student.email ?? undefined,
        userId,
        notes: s.notes,
        isDone: s.isDone,
        updatedAt: s.updatedAt,
        createdAt: s.createdAt,
        lessonUpdatedAt: s.lesson.updatedAt,
        studentUpdatedAt: s.lesson.student.updatedAt,
      };
      const vevent = this.icalendarService.sessionToVevent(sessionEvent);
      const ical = this.icalendarService.wrapVcalendar([vevent]);
      const effectiveUpdatedAt = getEffectiveUpdatedAt(sessionEvent);
      const etag = generateEtag(s.uuid, effectiveUpdatedAt);
      return {
        href: `/caldav/principals/${userId}/calendars/lessons/${s.uuid}.ics`,
        etag,
        updatedAt: effectiveUpdatedAt,
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
      const effectiveUpdatedAt = getEffectiveUpdatedAt(s);
      const etag = generateEtag(s.uuid, effectiveUpdatedAt);
      return {
        href: `/caldav/principals/${userId}/calendars/lessons/${s.uuid}.ics`,
        etag,
        updatedAt: effectiveUpdatedAt,
        createdAt: s.createdAt,
        icalData: ical,
      };
    });

    return this.xmlBuilderService.buildMultigetResponse(events);
  }

  async handleSyncCollection(session: DavSession, syncToken: string | null): Promise<string> {
    const userId = session.user.id;
    const sinceDate = syncToken ? parseSyncToken(syncToken) : null;

    // For sync-collection, we need to detect changes in session, lesson, or student
    // So we query sessions with their related lesson/student updatedAt values
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
        // Include sessions where session, lesson, or student was updated
        ...(sinceDate && {
          OR: [
            { updatedAt: { gt: sinceDate } },
            { lesson: { updatedAt: { gt: sinceDate } } },
            { lesson: { student: { updatedAt: { gt: sinceDate } } } },
          ],
        }),
      },
      select: {
        uuid: true,
        updatedAt: true,
        lesson: {
          select: {
            updatedAt: true,
            student: {
              select: {
                updatedAt: true,
              },
            },
          },
        },
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

    const changed = changedSessions.map(s => {
      const effectiveUpdatedAt = new Date(Math.max(
        s.updatedAt.getTime(),
        s.lesson.updatedAt.getTime(),
        s.lesson.student.updatedAt.getTime(),
      ));
      return {
        href: `/caldav/principals/${userId}/calendars/lessons/${s.uuid}.ics`,
        etag: generateEtag(s.uuid, effectiveUpdatedAt),
      };
    });

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
          select: {
            title: true,
            updatedAt: true,
            student: {
              select: { name: true, uuid: true, email: true, updatedAt: true },
            },
          },
        },
      },
    });

    if (!session) {
      return { error: 'not_found' };
    }

    if (expectedEtag) {
      const currentEffectiveUpdatedAt = new Date(Math.max(
        session.updatedAt.getTime(),
        session.lesson.updatedAt.getTime(),
        session.lesson.student.updatedAt.getTime(),
      ));
      const currentEtag = generateEtag(session.uuid, currentEffectiveUpdatedAt);
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
          select: {
            title: true,
            updatedAt: true,
            student: {
              select: { name: true, uuid: true, email: true, updatedAt: true },
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
      studentUuid: updatedSession.lesson.student.uuid,
      studentEmail: updatedSession.lesson.student.email ?? undefined,
      userId,
      notes: updatedSession.notes,
      isDone: updatedSession.isDone,
      updatedAt: updatedSession.updatedAt,
      createdAt: updatedSession.createdAt,
      lessonUpdatedAt: updatedSession.lesson.updatedAt,
      studentUpdatedAt: updatedSession.lesson.student.updatedAt,
    };

    return {
      session: result,
      etag: generateEtag(result.uuid, getEffectiveUpdatedAt(result)),
    };
  }
}
