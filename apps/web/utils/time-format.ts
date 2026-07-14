import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { tz } from '@date-fns/tz';

export function formatTime(date: Date | string, use24HourFormat: boolean, timeZone: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, use24HourFormat ? 'HH:mm' : 'a hh:mm', { in: tz(timeZone), locale: ko });
}
