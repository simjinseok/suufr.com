import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleService } from '../google.service';
import type { GoogleCalendarEvent, SyncResult } from '../dto';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const TIMEZONE = 'Asia/Seoul';

interface CalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
}

interface EventsListResponse {
  items?: GoogleCalendarEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleService: GoogleService,
  ) {}

  /**
   * Get or create the target calendar for syncing
   */
  async getOrCreateCalendar(userId: string, accessToken: string): Promise<string> {
    const syncToken = await this.googleService.getSyncToken(userId);

    // If we already have a calendar ID, verify it still exists
    if (syncToken?.calendarId) {
      const exists = await this.calendarExists(syncToken.calendarId, accessToken);
      if (exists) {
        return syncToken.calendarId;
      }
    }

    // Use primary calendar
    const primaryCalendar = await this.getPrimaryCalendar(accessToken);
    if (primaryCalendar) {
      await this.googleService.updateSyncToken(userId, { calendarId: primaryCalendar.id });
      return primaryCalendar.id;
    }

    throw new Error('No calendar found');
  }

  private async calendarExists(calendarId: string, accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return response.ok;
    }
    catch {
      return false;
    }
  }

  private async getPrimaryCalendar(accessToken: string): Promise<CalendarListEntry | null> {
    const response = await fetch(`${CALENDAR_API_BASE}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error('Failed to list calendars');
    }

    const data = await response.json() as { items?: CalendarListEntry[] };
    return data.items?.find(c => c.primary) ?? data.items?.[0] ?? null;
  }

  /**
   * Sync all sessions to Google Calendar
   */
  async syncAll(userId: string, accessToken: string): Promise<SyncResult> {
    const calendarId = await this.getOrCreateCalendar(userId, accessToken);
    const result: SyncResult = { created: 0, updated: 0, deleted: 0, errors: 0 };

    // Get all sessions for this user
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
      },
      include: {
        lesson: {
          include: {
            student: true,
          },
        },
        googleEvent: true,
      },
    });

    // Push each session to Google Calendar
    for (const session of sessions) {
      try {
        if (session.googleEvent) {
          // Update existing event
          await this.updateEvent(
            calendarId,
            session.googleEvent.googleEventId,
            this.sessionToEvent(session),
            accessToken,
          );
          result.updated++;
        }
        else {
          // Create new event
          const event = await this.createEvent(calendarId, this.sessionToEvent(session), accessToken);
          await this.prisma.sessionGoogleEvent.create({
            data: {
              sessionId: session.id,
              userId,
              googleEventId: event.id!,
              googleCalendarId: calendarId,
              lastSyncedAt: new Date(),
              syncStatus: 'synced',
            },
          });
          result.created++;
        }
      }
      catch (error) {
        this.logger.error(`Failed to sync session ${session.uuid}:`, error);
        result.errors++;
      }
    }

    // Handle deleted sessions (soft deleted in Suufr but still have Google events)
    const orphanedEvents = await this.prisma.sessionGoogleEvent.findMany({
      where: {
        userId,
        session: {
          OR: [
            { deletedAt: { not: null } },
            { lesson: { deletedAt: { not: null } } },
            { lesson: { student: { deletedAt: { not: null } } } },
          ],
        },
      },
    });

    for (const mapping of orphanedEvents) {
      try {
        await this.deleteEvent(mapping.googleCalendarId, mapping.googleEventId, accessToken);
        await this.prisma.sessionGoogleEvent.delete({ where: { id: mapping.id } });
        result.deleted++;
      }
      catch (error) {
        this.logger.error(`Failed to delete orphaned event ${mapping.googleEventId}:`, error);
        result.errors++;
      }
    }

    // Update last sync time
    await this.googleService.updateSyncToken(userId, { lastCalendarSyncAt: new Date() });

    return result;
  }

  /**
   * Push a single session to Google Calendar (called on session create/update)
   */
  async pushSession(sessionId: number, userId: string): Promise<void> {
    const accessToken = await this.googleService.getAccessToken(userId);
    if (!accessToken) {
      this.logger.debug(`No Google connection for user ${userId}, skipping push`);
      return;
    }

    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
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
          include: { student: true },
        },
        googleEvent: true,
      },
    });

    if (!session) {
      return;
    }

    try {
      const calendarId = await this.getOrCreateCalendar(userId, accessToken);
      const eventData = this.sessionToEvent(session);

      if (session.googleEvent) {
        await this.updateEvent(calendarId, session.googleEvent.googleEventId, eventData, accessToken);
        await this.prisma.sessionGoogleEvent.update({
          where: { id: session.googleEvent.id },
          data: { lastSyncedAt: new Date(), syncStatus: 'synced', errorMessage: null },
        });
      }
      else {
        const event = await this.createEvent(calendarId, eventData, accessToken);
        await this.prisma.sessionGoogleEvent.create({
          data: {
            sessionId: session.id,
            userId,
            googleEventId: event.id!,
            googleCalendarId: calendarId,
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
          },
        });
      }
    }
    catch (error) {
      this.logger.error(`Failed to push session ${sessionId}:`, error);
      if (session.googleEvent) {
        await this.prisma.sessionGoogleEvent.update({
          where: { id: session.googleEvent.id },
          data: { syncStatus: 'error', errorMessage: String(error) },
        });
      }
    }
  }

  /**
   * Delete a session from Google Calendar (called on session delete)
   */
  async deleteSession(sessionId: number, userId: string): Promise<void> {
    const accessToken = await this.googleService.getAccessToken(userId);
    if (!accessToken) {
      return;
    }

    const mapping = await this.prisma.sessionGoogleEvent.findUnique({
      where: { sessionId },
    });

    if (!mapping) {
      return;
    }

    try {
      await this.deleteEvent(mapping.googleCalendarId, mapping.googleEventId, accessToken);
      await this.prisma.sessionGoogleEvent.delete({ where: { id: mapping.id } });
    }
    catch (error) {
      this.logger.error(`Failed to delete session ${sessionId} from Google:`, error);
    }
  }

  /**
   * Pull changes from Google Calendar (incremental sync)
   */
  async pullChanges(userId: string, accessToken: string): Promise<SyncResult> {
    const syncTokenRecord = await this.googleService.getSyncToken(userId);
    if (!syncTokenRecord?.calendarId) {
      return { created: 0, updated: 0, deleted: 0, errors: 0 };
    }

    const result: SyncResult = { created: 0, updated: 0, deleted: 0, errors: 0 };
    let pageToken: string | undefined;
    const calendarId = syncTokenRecord.calendarId;

    do {
      const params = new URLSearchParams();
      if (syncTokenRecord.calendarSyncToken && !pageToken) {
        params.set('syncToken', syncTokenRecord.calendarSyncToken);
      }
      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const response = await fetch(
        `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (response.status === 410) {
        // Sync token expired, need full sync
        await this.googleService.updateSyncToken(userId, { calendarSyncToken: null });
        return this.syncAll(userId, accessToken);
      }

      if (!response.ok) {
        throw new Error(`Failed to list events: ${response.status}`);
      }

      const data = await response.json() as EventsListResponse;

      for (const event of data.items ?? []) {
        try {
          await this.processGoogleEvent(event, userId, calendarId);
          result.updated++;
        }
        catch (error) {
          this.logger.error(`Failed to process event ${event.id}:`, error);
          result.errors++;
        }
      }

      pageToken = data.nextPageToken;

      if (data.nextSyncToken) {
        await this.googleService.updateSyncToken(userId, {
          calendarSyncToken: data.nextSyncToken,
          lastCalendarSyncAt: new Date(),
        });
      }
    } while (pageToken);

    return result;
  }

  private async processGoogleEvent(
    event: GoogleCalendarEvent,
    userId: string,
    calendarId: string,
  ): Promise<void> {
    // Find if this event is linked to a Suufr session
    const suufrUuid = event.extendedProperties?.private?.suufrSessionUuid;
    if (!suufrUuid) {
      return; // Not a Suufr event
    }

    const session = await this.prisma.session.findFirst({
      where: {
        uuid: suufrUuid,
        lesson: {
          student: { userId },
        },
      },
      include: { googleEvent: true },
    });

    if (!session) {
      return;
    }

    // Update session from Google event
    if (event.start?.dateTime && event.end?.dateTime) {
      const sessionAt = new Date(event.start.dateTime);
      const endAt = new Date(event.end.dateTime);
      const duration = Math.round((endAt.getTime() - sessionAt.getTime()) / 60000);

      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          sessionAt,
          duration: duration > 0 ? duration : session.duration,
          notes: event.description ?? session.notes,
        },
      });
    }

    // Update or create mapping
    if (session.googleEvent) {
      await this.prisma.sessionGoogleEvent.update({
        where: { id: session.googleEvent.id },
        data: { lastSyncedAt: new Date(), syncStatus: 'synced' },
      });
    }
    else if (event.id) {
      await this.prisma.sessionGoogleEvent.create({
        data: {
          sessionId: session.id,
          userId,
          googleEventId: event.id,
          googleCalendarId: calendarId,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
        },
      });
    }
  }

  private sessionToEvent(session: {
    uuid: string;
    sessionAt: Date;
    duration: number;
    notes: string;
    lesson: {
      title: string;
      student: { name: string };
    };
  }): GoogleCalendarEvent {
    const endAt = new Date(session.sessionAt.getTime() + session.duration * 60 * 1000);

    return {
      summary: `[${session.lesson.student.name}] ${session.lesson.title}`,
      description: session.notes || '',
      start: {
        dateTime: session.sessionAt.toISOString(),
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: endAt.toISOString(),
        timeZone: TIMEZONE,
      },
      extendedProperties: {
        private: {
          suufrSessionUuid: session.uuid,
        },
      },
    };
  }

  private async createEvent(
    calendarId: string,
    event: GoogleCalendarEvent,
    accessToken: string,
  ): Promise<GoogleCalendarEvent> {
    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create event: ${error}`);
    }

    return response.json() as Promise<GoogleCalendarEvent>;
  }

  private async updateEvent(
    calendarId: string,
    eventId: string,
    event: GoogleCalendarEvent,
    accessToken: string,
  ): Promise<GoogleCalendarEvent> {
    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update event: ${error}`);
    }

    return response.json() as Promise<GoogleCalendarEvent>;
  }

  private async deleteEvent(
    calendarId: string,
    eventId: string,
    accessToken: string,
  ): Promise<void> {
    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    // 404 is ok - event already deleted
    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Failed to delete event: ${error}`);
    }
  }
}
