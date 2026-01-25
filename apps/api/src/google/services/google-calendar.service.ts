import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleService } from '../google.service';
import type { GoogleCalendarEvent, SyncResult } from '../dto';
import * as crypto from 'crypto';

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

interface WatchResponse {
  kind: string;
  id: string;
  resourceId: string;
  resourceUri: string;
  expiration: string;
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly webhookUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleService: GoogleService,
    private readonly configService: ConfigService,
  ) {
    this.webhookUrl = this.configService.get<string>('GOOGLE_WEBHOOK_URL') ?? '';
  }

  /**
   * Get or create the target calendar for syncing
   * Creates an app-dedicated calendar instead of using the primary calendar
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

    // Create app-dedicated calendar
    const calendar = await this.createCalendar('스프 수업', accessToken);
    await this.googleService.updateSyncToken(userId, { calendarId: calendar.id });
    this.logger.log(`Created app calendar for user ${userId}: ${calendar.id}`);
    return calendar.id;
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

  private async createCalendar(summary: string, accessToken: string): Promise<{ id: string; summary: string }> {
    const response = await fetch(`${CALENDAR_API_BASE}/calendars`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ summary, timeZone: TIMEZONE }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create calendar: ${error}`);
    }

    return response.json() as Promise<{ id: string; summary: string }>;
  }

  /**
   * Fetch all events from Google Calendar
   */
  private async fetchAllGoogleEvents(calendarId: string, accessToken: string): Promise<GoogleCalendarEvent[]> {
    const events: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        maxResults: '250',
        singleEvents: 'true',
        showDeleted: 'false',
      });
      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const response = await fetch(
        `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }

      const data = await response.json() as EventsListResponse;
      events.push(...(data.items ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    return events;
  }

  /**
   * Sync all sessions to Google Calendar with full reconciliation
   */
  async syncAll(userId: string, accessToken: string): Promise<SyncResult> {
    const calendarId = await this.getOrCreateCalendar(userId, accessToken);
    const result: SyncResult = { created: 0, updated: 0, deleted: 0, errors: 0 };

    // Fetch data in parallel
    const [sessions, googleEvents, orphanedEvents] = await Promise.all([
      // Get all active sessions for this user
      this.prisma.session.findMany({
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
      }),
      // Get all events from Google Calendar
      this.fetchAllGoogleEvents(calendarId, accessToken),
      // Get orphaned events (soft deleted in Suufr)
      this.prisma.sessionGoogleEvent.findMany({
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
      }),
    ]);

    // Build lookup maps
    const sessionByUuid = new Map(sessions.map(s => [s.uuid, s]));
    const googleEventByUuid = new Map<string, GoogleCalendarEvent>();
    const externalEventIds: string[] = [];

    for (const event of googleEvents) {
      const suufrUuid = event.extendedProperties?.private?.suufrSessionUuid;
      if (suufrUuid) {
        googleEventByUuid.set(suufrUuid, event);
      }
      else if (event.id) {
        // Event without suufrSessionUuid = created externally
        externalEventIds.push(event.id);
      }
    }

    // Prepare operations as factory functions for lazy execution
    const createOps: (() => Promise<void>)[] = [];
    const updateOps: (() => Promise<void>)[] = [];
    const deleteOps: (() => Promise<void>)[] = [];

    // 1. Process sessions: create or update
    for (const session of sessions) {
      const existingEvent = googleEventByUuid.get(session.uuid);

      if (existingEvent?.id) {
        // Update existing event
        const eventId = existingEvent.id;
        updateOps.push(() =>
          this.updateEvent(calendarId, eventId, this.sessionToEvent(session), accessToken)
            .then(async () => {
              if (session.googleEvent) {
                await this.prisma.sessionGoogleEvent.update({
                  where: { id: session.googleEvent.id },
                  data: { lastSyncedAt: new Date(), syncStatus: 'synced', errorMessage: null },
                });
              }
              else {
                await this.prisma.sessionGoogleEvent.create({
                  data: {
                    sessionId: session.id,
                    userId,
                    googleEventId: eventId,
                    googleCalendarId: calendarId,
                    lastSyncedAt: new Date(),
                    syncStatus: 'synced',
                  },
                });
              }
              result.updated++;
            })
            .catch((error) => {
              this.logger.error(`Failed to update session ${session.uuid}:`, error);
              result.errors++;
            }),
        );
      }
      else {
        // Create new event
        createOps.push(() =>
          this.createEvent(calendarId, this.sessionToEvent(session), accessToken)
            .then(async (event) => {
              if (session.googleEvent) {
                await this.prisma.sessionGoogleEvent.update({
                  where: { id: session.googleEvent.id },
                  data: {
                    googleEventId: event.id!,
                    googleCalendarId: calendarId,
                    lastSyncedAt: new Date(),
                    syncStatus: 'synced',
                    errorMessage: null,
                  },
                });
              }
              else {
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
              result.created++;
            })
            .catch((error) => {
              this.logger.error(`Failed to create session ${session.uuid}:`, error);
              result.errors++;
            }),
        );
      }
    }

    // 2. Delete orphaned events (soft deleted in Suufr)
    for (const mapping of orphanedEvents) {
      deleteOps.push(() =>
        this.deleteEvent(mapping.googleCalendarId, mapping.googleEventId, accessToken)
          .then(() => this.prisma.sessionGoogleEvent.delete({ where: { id: mapping.id } }))
          .then(() => { result.deleted++; })
          .catch((error) => {
            this.logger.error(`Failed to delete orphaned event ${mapping.googleEventId}:`, error);
            result.errors++;
          }),
      );
    }

    // 3. Delete external events (not linked to any Suufr session)
    for (const eventId of externalEventIds) {
      deleteOps.push(() =>
        this.deleteEvent(calendarId, eventId, accessToken)
          .then(() => {
            this.logger.log(`Deleted external event: ${eventId}`);
            result.deleted++;
          })
          .catch((error) => {
            this.logger.error(`Failed to delete external event ${eventId}:`, error);
            result.errors++;
          }),
      );
    }

    // 4. Handle Google events linked to non-existent sessions
    for (const [uuid, event] of googleEventByUuid) {
      if (!sessionByUuid.has(uuid) && event.id) {
        const eventId = event.id;
        deleteOps.push(() =>
          this.deleteEvent(calendarId, eventId, accessToken)
            .then(() => {
              this.logger.log(`Deleted event for non-existent session: ${uuid}`);
              result.deleted++;
            })
            .catch((error) => {
              this.logger.error(`Failed to delete event ${eventId}:`, error);
              result.errors++;
            }),
        );
      }
    }

    // Execute all operations in batches to avoid rate limiting
    await this.executeBatched([...createOps, ...updateOps, ...deleteOps]);

    // Update last sync time
    await this.googleService.updateSyncToken(userId, { lastCalendarSyncAt: new Date() });

    // Always register webhook on sync
    await this.registerWatch(userId, calendarId, accessToken).catch(err =>
      this.logger.error(`Failed to register watch for user ${userId}:`, err),
    );

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
    const calendarId = syncTokenRecord.calendarId;

    // Defensive check: verify calendar exists before processing events
    // This prevents session deletions when calendar was deleted externally
    const exists = await this.calendarExists(calendarId, accessToken);
    if (!exists) {
      this.logger.warn(`Calendar ${calendarId} deleted externally for user ${userId}, clearing sync (sessions preserved)`);
      await this.googleService.clearCalendarSync(userId);
      return { created: 0, updated: 0, deleted: 0, errors: 0 };
    }

    let pageToken: string | undefined;

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

      if (response.status === 404) {
        // Calendar not found (deleted externally or disconnected)
        this.logger.warn(`Calendar not found for user ${userId}, clearing sync data`);
        await this.googleService.clearCalendarSync(userId);
        return { created: 0, updated: 0, deleted: 0, errors: 0 };
      }

      if (!response.ok) {
        throw new Error(`Failed to list events: ${response.status}`);
      }

      const data = await response.json() as EventsListResponse;

      for (const event of data.items ?? []) {
        try {
          const { action } = await this.processGoogleEvent(event, userId, calendarId, accessToken);
          if (action === 'updated') {
            result.updated++;
          }
          else if (action === 'deleted') {
            result.deleted++;
          }
          else if (action === 'restored') {
            result.created++;
          }
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
    accessToken: string,
  ): Promise<{ action: 'updated' | 'deleted' | 'skipped' | 'restored' }> {
    // Find if this event is linked to a Suufr session
    const suufrUuid = event.extendedProperties?.private?.suufrSessionUuid;

    if (!suufrUuid) {
      // Event created outside of Suufr → delete it
      if (event.status !== 'cancelled' && event.id) {
        await this.deleteEvent(calendarId, event.id, accessToken);
        this.logger.log(`Deleted external event: ${event.id}`);
        return { action: 'deleted' };
      }
      return { action: 'skipped' };
    }

    const session = await this.prisma.session.findFirst({
      where: {
        uuid: suufrUuid,
        deletedAt: null,
        lesson: {
          deletedAt: null,
          student: { userId, deletedAt: null },
        },
      },
      include: {
        googleEvent: true,
        lesson: {
          include: { student: true },
        },
      },
    });

    if (!session) {
      return { action: 'skipped' };
    }

    // Event is cancelled = deleted in Google Calendar
    // Sync the deletion to Suufr by soft deleting the session
    if (event.status === 'cancelled') {
      // Soft delete the Suufr session
      await this.prisma.session.update({
        where: { uuid: session.uuid },
        data: { deletedAt: new Date() },
      });

      // Delete the sync mapping
      if (session.googleEvent) {
        await this.prisma.sessionGoogleEvent.delete({
          where: { id: session.googleEvent.id },
        });
      }

      this.logger.log(`Deleted session ${session.uuid} (Google Calendar event was cancelled)`);
      return { action: 'deleted' };
    }

    // Update session from Google event (allowed changes: date/time, description)
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

    // Restore summary if it was changed (not allowed)
    const expectedSummary = `[${session.lesson.student.name}] ${session.lesson.title}`;
    if (event.summary !== expectedSummary && event.id) {
      await this.updateEvent(calendarId, event.id, {
        ...event,
        summary: expectedSummary,
      }, accessToken);
      this.logger.log(`Restored summary for event ${event.id}`);
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

    return { action: 'updated' };
  }

  /**
   * Recreate an event in Google Calendar when it was deleted or moved
   */
  private async recreateEvent(
    session: {
      id: number;
      uuid: string;
      sessionAt: Date;
      duration: number;
      notes: string;
      googleEvent: { id: number } | null;
      lesson: {
        title: string;
        student: { name: string; userId: string };
      };
    },
    userId: string,
    calendarId: string,
    accessToken: string,
  ): Promise<void> {
    const eventData = this.sessionToEvent(session);
    const event = await this.createEvent(calendarId, eventData, accessToken);

    // Update or create mapping
    if (session.googleEvent) {
      await this.prisma.sessionGoogleEvent.update({
        where: { id: session.googleEvent.id },
        data: {
          googleEventId: event.id!,
          googleCalendarId: calendarId,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
        },
      });
    }
    else {
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

    this.logger.log(`Recreated event for session ${session.uuid}`);
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
          'Authorization': `Bearer ${accessToken}`,
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
          'Authorization': `Bearer ${accessToken}`,
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

  /**
   * Execute promises in batches with delay between batches to avoid rate limiting
   */
  private async executeBatched<T>(
    tasks: (() => Promise<T>)[],
    batchSize: number = 3,
    delayMs: number = 500,
  ): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(task => task()));
      results.push(...batchResults);
      if (i + batchSize < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return results;
  }

  /**
   * Register a webhook to receive calendar change notifications
   */
  async registerWatch(userId: string, calendarId: string, accessToken: string): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.warn('GOOGLE_WEBHOOK_URL not configured, skipping watch registration');
      return;
    }

    // Generate unique channel ID
    const channelId = crypto.randomUUID();

    // Watch expires in 7 days (maximum allowed by Google)
    const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: this.webhookUrl,
          expiration: expiration.toString(),
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to register watch: ${error}`);
      return;
    }

    const data = await response.json() as WatchResponse;

    // Save watch info to database
    await this.googleService.updateSyncToken(userId, {
      webhookChannelId: data.id,
      webhookResourceId: data.resourceId,
      webhookExpiration: new Date(parseInt(data.expiration, 10)),
    });

    this.logger.log(`Watch registered for user ${userId}, expires at ${new Date(parseInt(data.expiration, 10)).toISOString()}`);
  }

  /**
   * Stop watching a calendar (when disconnecting)
   */
  async stopWatch(userId: string, accessToken: string): Promise<void> {
    const syncToken = await this.googleService.getSyncToken(userId);
    if (!syncToken?.webhookChannelId || !syncToken?.webhookResourceId) {
      return;
    }

    const response = await fetch(
      `${CALENDAR_API_BASE}/channels/stop`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: syncToken.webhookChannelId,
          resourceId: syncToken.webhookResourceId,
        }),
      },
    );

    if (!response.ok && response.status !== 404) {
      this.logger.error(`Failed to stop watch: ${await response.text()}`);
    }

    // Clear watch info
    await this.googleService.updateSyncToken(userId, {
      webhookChannelId: null,
      webhookResourceId: null,
      webhookExpiration: null,
    });

    this.logger.log(`Watch stopped for user ${userId}`);
  }

  /**
   * Handle webhook notification from Google
   */
  async handleWebhook(channelId: string, resourceState: string): Promise<void> {
    if (resourceState === 'sync') {
      // Initial sync notification, ignore
      this.logger.debug(`Received sync notification for channel ${channelId}`);
      return;
    }

    if (resourceState !== 'exists') {
      this.logger.debug(`Ignoring resource state: ${resourceState}`);
      return;
    }

    // Find user by channel ID
    const userId = await this.googleService.findUserByWebhookChannel(channelId);
    if (!userId) {
      // 연동 해제 후 webhook이 도착한 경우 무시
      this.logger.warn(`No user found for webhook channel ${channelId}, ignoring`);
      return;
    }

    // Get access token and pull changes
    const accessToken = await this.googleService.getAccessToken(userId);
    if (!accessToken) {
      this.logger.warn(`No access token for user ${userId}`);
      return;
    }

    // Check if calendar still exists before processing changes
    // This protects sessions when user deletes the entire "스프 수업" calendar
    const syncToken = await this.googleService.getSyncToken(userId);
    if (syncToken?.calendarId) {
      const exists = await this.calendarExists(syncToken.calendarId, accessToken);
      if (!exists) {
        this.logger.warn(`Calendar ${syncToken.calendarId} deleted externally for user ${userId}, clearing sync (sessions preserved)`);
        await this.googleService.clearCalendarSync(userId);
        return; // Skip pullChanges to prevent session deletions
      }
    }

    try {
      const result = await this.pullChanges(userId, accessToken);
      this.logger.log(`Webhook sync for user ${userId}: ${JSON.stringify(result)}`);
    }
    catch (error) {
      this.logger.error(`Failed to handle webhook for user ${userId}:`, error);
    }
  }
}
