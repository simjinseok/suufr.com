import { Injectable, Logger } from '@nestjs/common';

export interface SessionEvent {
  uuid: string;
  sessionAt: Date;
  duration: number; // minutes
  studentName: string;
  userId: string;
  notes: string;
  isDone: boolean;
  updatedAt: Date;
  createdAt: Date;
  studentUpdatedAt: Date;
}

export interface ParsedICalendarEvent {
  uid: string;
  description?: string | null;
  dtstart?: Date;
  dtend?: Date;
}

@Injectable()
export class ICalendarService {
  private readonly logger = new Logger(ICalendarService.name);
  private readonly TIMEZONE = 'Asia/Seoul';
  private readonly PRODID = '-//Suufr//CalDAV//KO';

  /**
   * Intl.DateTimeFormat 인스턴스를 캐싱하여 성능 최적화
   */
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  sessionToVevent(session: SessionEvent): string {
    const dtstart = this.formatLocalDateTime(session.sessionAt);
    const dtend = this.formatLocalDateTime(new Date(session.sessionAt.getTime() + session.duration * 60 * 1000));
    // Use effective updatedAt (max of session, student) for DTSTAMP/LAST-MODIFIED/SEQUENCE
    const effectiveUpdatedAt = new Date(Math.max(
      session.updatedAt.getTime(),
      session.studentUpdatedAt.getTime(),
    ));
    const dtstamp = this.formatUtcDateTime(effectiveUpdatedAt);
    const lastModified = this.formatUtcDateTime(effectiveUpdatedAt);
    const summary = session.studentName;
    const status = session.isDone ? 'COMPLETED' : 'CONFIRMED';
    const sequence = Math.floor(effectiveUpdatedAt.getTime() / 1000) % 1000000;

    const lines: string[] = [
      'BEGIN:VEVENT',
      `UID:${session.uuid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=${this.TIMEZONE}:${dtstart}`,
      `DTEND;TZID=${this.TIMEZONE}:${dtend}`,
      this.foldLine(`SUMMARY:${this.escapeICalValue(summary)}`),
      `STATUS:${status}`,
      `LAST-MODIFIED:${lastModified}`,
      `SEQUENCE:${sequence}`,
    ];

    if (session.notes) {
      lines.push(this.foldLine(`DESCRIPTION:${this.escapeICalValue(session.notes)}`));
    }

    lines.push('END:VEVENT');

    return lines.join('\r\n');
  }

  /**
   * Wrap VEVENT(s) in a VCALENDAR
   */
  wrapVcalendar(vevents: string[]): string {
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:${this.PRODID}`,
      'CALSCALE:GREGORIAN',
      // METHOD 제거 - CalDAV 객체 저장 시에는 METHOD를 포함하지 않는 것이 표준
      this.buildTimezoneComponent(),
      ...vevents,
      'END:VCALENDAR',
    ];

    return lines.join('\r\n') + '\r\n';
  }

  /**
   * Build VTIMEZONE component for Asia/Seoul
   */
  private buildTimezoneComponent(): string {
    return `BEGIN:VTIMEZONE
TZID:Asia/Seoul
X-LIC-LOCATION:Asia/Seoul
BEGIN:STANDARD
TZOFFSETFROM:+0900
TZOFFSETTO:+0900
TZNAME:KST
DTSTART:19700101T000000
END:STANDARD
END:VTIMEZONE`;
  }

  /**
   * Format Date to iCalendar local datetime format: YYYYMMDDTHHMMSS
   * Used with TZID parameter for DTSTART/DTEND
   * @see RFC 5545 Section 3.3.5 (DATE-TIME)
   */
  private formatLocalDateTime(date: Date): string {
    const parts = this.dateTimeFormatter.formatToParts(date);
    const getValue = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find(p => p.type === type)?.value ?? '00';

    const year = getValue('year');
    const month = getValue('month');
    const day = getValue('day');
    const hour = getValue('hour');
    const minute = getValue('minute');
    const second = getValue('second');

    return `${year}${month}${day}T${hour}${minute}${second}`;
  }

  /**
   * Format Date to iCalendar UTC datetime format: YYYYMMDDTHHMMSSZ
   * Used for DTSTAMP and LAST-MODIFIED (must be UTC per RFC 5545)
   * @see RFC 5545 Section 3.3.5 (DATE-TIME)
   */
  private formatUtcDateTime(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  }

  /**
   * Escape special characters in iCalendar TEXT values
   * Order matters: backslash must be escaped first to avoid double-escaping
   * @see RFC 5545 Section 3.3.11 (TEXT)
   */
  private escapeICalValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n');
  }

  /**
   * Fold long lines at 75 octets (UTF-8 safe)
   * Continuation lines start with a single space
   * @see RFC 5545 Section 3.1 (Content Lines)
   */
  private foldLine(line: string): string {
    const MAX_OCTETS = 75;

    const lineBytes = Buffer.byteLength(line, 'utf8');
    if (lineBytes <= MAX_OCTETS) {
      return line;
    }

    const result: string[] = [];
    let currentLine = '';
    let currentOctets = 0;
    let isFirstLine = true;

    for (const char of line) {
      const charBytes = Buffer.byteLength(char, 'utf8');
      const maxForThisLine = isFirstLine ? MAX_OCTETS : MAX_OCTETS - 1;

      if (currentOctets + charBytes > maxForThisLine) {
        result.push(currentLine);
        currentLine = ' ' + char;
        currentOctets = 1 + charBytes;
        isFirstLine = false;
      }
      else {
        currentLine += char;
        currentOctets += charBytes;
      }
    }

    if (currentLine) {
      result.push(currentLine);
    }

    return result.join('\r\n');
  }

  parseICalendar(icalData: string): ParsedICalendarEvent | null {
    const lines = this.unfoldLines(icalData);
    let uid: string | null = null;
    let description: string | null = null;
    let dtstart: Date | undefined;
    let dtend: Date | undefined;
    let inVevent = false;

    for (const line of lines) {
      const upperLine = line.toUpperCase();

      if (upperLine === 'BEGIN:VEVENT') {
        inVevent = true;
        continue;
      }

      if (upperLine === 'END:VEVENT') {
        break;
      }

      if (!inVevent) continue;

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const property = line.slice(0, colonIndex);
      const value = line.slice(colonIndex + 1);

      // Handle properties with parameters (e.g., DTSTART;TZID=Asia/Seoul:20240101T100000)
      const propertyUpper = property.toUpperCase();
      const propertyName = propertyUpper.split(';')[0];

      switch (propertyName) {
        case 'UID':
          uid = value.trim();
          break;
        case 'DESCRIPTION':
          description = this.unescapeICalValue(value);
          break;
        case 'DTSTART':
          dtstart = this.parseICalDateTime(value, property);
          break;
        case 'DTEND':
          dtend = this.parseICalDateTime(value, property);
          break;
      }
    }

    if (!uid) {
      return null;
    }

    return {
      uid,
      description,
      dtstart,
      dtend,
    };
  }

  private parseICalDateTime(value: string, property: string): Date | undefined {
    try {
      const dateStr = value.trim();
      this.logger.debug(`parseICalDateTime - value: ${dateStr}, property: ${property}`);

      if (dateStr.endsWith('Z')) {
        return this.parseICalDateTimeString(dateStr.slice(0, -1), true);
      }

      const tzidMatch = property.match(/TZID=([^;:]+)/i);
      const tzid = tzidMatch?.[1] ?? this.TIMEZONE;

      return this.parseICalDateTimeWithTzid(dateStr, tzid);
    }
    catch (e) {
      this.logger.error(`parseICalDateTime error: ${e}`);
      return undefined;
    }
  }

  private parseICalDateTimeString(dateStr: string, isUtc: boolean): Date {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10) - 1;
    const day = parseInt(dateStr.slice(6, 8), 10);
    const hours = parseInt(dateStr.slice(9, 11), 10);
    const minutes = parseInt(dateStr.slice(11, 13), 10);
    const seconds = parseInt(dateStr.slice(13, 15), 10) || 0;

    if (isUtc) {
      return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
    }

    return new Date(year, month, day, hours, minutes, seconds);
  }

  private parseICalDateTimeWithTzid(dateStr: string, tzid: string): Date {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10) - 1;
    const day = parseInt(dateStr.slice(6, 8), 10);
    const hours = parseInt(dateStr.slice(9, 11), 10);
    const minutes = parseInt(dateStr.slice(11, 13), 10);
    const seconds = parseInt(dateStr.slice(13, 15), 10) || 0;

    const offsetMinutes = this.getTimezoneOffsetMinutes(tzid, year, month, day, hours, minutes);

    return new Date(Date.UTC(year, month, day, hours, minutes - offsetMinutes, seconds));
  }

  private getTimezoneOffsetMinutes(
    tzid: string,
    year: number,
    month: number,
    day: number,
    hours: number,
    minutes: number,
  ): number {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tzid,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, 0));
      const parts = formatter.formatToParts(utcDate);
      const getValue = (type: Intl.DateTimeFormatPartTypes): number =>
        parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);

      const localYear = getValue('year');
      const localMonth = getValue('month') - 1;
      const localDay = getValue('day');
      const localHour = getValue('hour');
      const localMinute = getValue('minute');

      const localAsUtc = Date.UTC(localYear, localMonth, localDay, localHour, localMinute, 0);
      const offsetMs = localAsUtc - utcDate.getTime();

      return offsetMs / (60 * 1000);
    }
    catch {
      return 9 * 60;
    }
  }

  /**
   * Unfold iCalendar lines (reverse of foldLine)
   * Lines starting with space/tab are continuations of the previous line
   * @see RFC 5545 Section 3.1 (Content Lines)
   */
  private unfoldLines(icalData: string): string[] {
    const rawLines = icalData.split(/\r?\n/);
    const unfolded: string[] = [];

    for (const line of rawLines) {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        if (unfolded.length > 0) {
          unfolded[unfolded.length - 1] += line.slice(1);
        }
      }
      else {
        unfolded.push(line);
      }
    }

    return unfolded;
  }

  /** @see RFC 5545 Section 3.3.11 (TEXT) - unescape rules */
  private unescapeICalValue(value: string): string {
    return value
      .replace(/\\n/gi, '\n')
      .replace(/\\;/g, ';')
      .replace(/\\,/g, ',')
      .replace(/\\\\/g, '\\');
  }
}
