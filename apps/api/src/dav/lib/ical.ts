import type { Session, Lesson, Student } from '../../generated/prisma/client';

type SessionWithRelations = Session & {
  lesson: Lesson & {
    student: Student;
  };
};

export function sessionToIcal(session: SessionWithRelations): string {
  const startDate = session.sessionAt;
  const endDate = new Date(startDate.getTime() + session.duration * 60 * 1000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Suufr//Suufr Calendar//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${session.uuid}`,
    `DTSTAMP:${formatIcalDate(new Date())}`,
    `DTSTART:${formatIcalDate(startDate)}`,
    `DTEND:${formatIcalDate(endDate)}`,
    `SUMMARY:${escapeIcalText(`${session.lesson.student.name} - ${session.lesson.title}`)}`,
    `DESCRIPTION:${escapeIcalText(session.notes || '')}`,
    `STATUS:${session.isDone ? 'COMPLETED' : 'CONFIRMED'}`,
    `LAST-MODIFIED:${formatIcalDate(session.updatedAt)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

export function parseIcal(ical: string): {
  uid?: string;
  summary?: string;
  description?: string;
  dtstart?: Date;
  dtend?: Date;
  duration?: number;
} {
  const result: {
    uid?: string;
    summary?: string;
    description?: string;
    dtstart?: Date;
    dtend?: Date;
    duration?: number;
  } = {};

  const lines = unfoldLines(ical);

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).split(';')[0].toUpperCase();
    const value = line.slice(colonIndex + 1);

    switch (key) {
      case 'UID':
        result.uid = value;
        break;
      case 'SUMMARY':
        result.summary = unescapeIcalText(value);
        break;
      case 'DESCRIPTION':
        result.description = unescapeIcalText(value);
        break;
      case 'DTSTART':
        result.dtstart = parseIcalDate(value);
        break;
      case 'DTEND':
        result.dtend = parseIcalDate(value);
        break;
      case 'DURATION':
        result.duration = parseDuration(value);
        break;
    }
  }

  // Calculate duration from dtstart and dtend if not provided
  if (result.dtstart && result.dtend && !result.duration) {
    result.duration = Math.round((result.dtend.getTime() - result.dtstart.getTime()) / 60000);
  }

  return result;
}

function formatIcalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function parseIcalDate(value: string): Date {
  // Handle format: 20240115T090000Z or 20240115T180000
  const clean = value.replace(/[^0-9TZ]/g, '');

  if (clean.endsWith('Z')) {
    // UTC
    const year = parseInt(clean.slice(0, 4));
    const month = parseInt(clean.slice(4, 6)) - 1;
    const day = parseInt(clean.slice(6, 8));
    const hour = parseInt(clean.slice(9, 11));
    const minute = parseInt(clean.slice(11, 13));
    const second = parseInt(clean.slice(13, 15)) || 0;
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
  else {
    // Local time (treat as Korea timezone)
    const year = parseInt(clean.slice(0, 4));
    const month = parseInt(clean.slice(4, 6)) - 1;
    const day = parseInt(clean.slice(6, 8));
    const hour = parseInt(clean.slice(9, 11)) || 0;
    const minute = parseInt(clean.slice(11, 13)) || 0;
    const second = parseInt(clean.slice(13, 15)) || 0;
    return new Date(year, month, day, hour, minute, second);
  }
}

function parseDuration(value: string): number {
  // Parse ISO 8601 duration (e.g., PT1H30M)
  let minutes = 0;
  const hourMatch = value.match(/(\d+)H/);
  const minuteMatch = value.match(/(\d+)M/);

  if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
  if (minuteMatch) minutes += parseInt(minuteMatch[1]);

  return minutes;
}

function escapeIcalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function unescapeIcalText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function unfoldLines(ical: string): string[] {
  // RFC 5545: Lines longer than 75 chars are folded with CRLF + space/tab
  return ical
    .replace(/\r\n[ \t]/g, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => line.trim() !== '');
}

export function generateCalendarFeed(
  sessions: SessionWithRelations[],
  calendarName: string,
): string {
  const events = sessions.map((session) => {
    const startDate = session.sessionAt;
    const endDate = new Date(startDate.getTime() + session.duration * 60 * 1000);

    return [
      'BEGIN:VEVENT',
      `UID:${session.uuid}`,
      `DTSTAMP:${formatIcalDate(new Date())}`,
      `DTSTART:${formatIcalDate(startDate)}`,
      `DTEND:${formatIcalDate(endDate)}`,
      `SUMMARY:${escapeIcalText(`${session.lesson.student.name} - ${session.lesson.title}`)}`,
      `DESCRIPTION:${escapeIcalText(session.notes || '')}`,
      `STATUS:${session.isDone ? 'COMPLETED' : 'CONFIRMED'}`,
      `LAST-MODIFIED:${formatIcalDate(session.updatedAt)}`,
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Suufr//Suufr Calendar//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcalText(calendarName)}`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}
