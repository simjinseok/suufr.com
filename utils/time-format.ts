import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { tz } from '@date-fns/tz';
import type { TimeFormat } from '@/types/index';

const TIMEZONE = 'Asia/Seoul';

export function formatTime(date: Date | string, timeFormat: TimeFormat): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, timeFormat === '12h' ? 'a hh:mm' : 'HH:mm', { in: tz(TIMEZONE), locale: ko });
}
