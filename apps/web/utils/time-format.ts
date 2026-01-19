import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { tz } from '@date-fns/tz';

const TIMEZONE = 'Asia/Seoul';

export function formatTime(date: Date | string, use24HourFormat: boolean): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, use24HourFormat ? 'HH:mm' : 'a hh:mm', { in: tz(TIMEZONE), locale: ko });
}
