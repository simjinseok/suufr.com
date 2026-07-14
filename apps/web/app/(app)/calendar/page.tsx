import { getSession } from '@/utils/auth';
import { getUserSettings } from '@/utils/user-settings';
import { DEFAULT_TIMEZONE } from '@/utils/timezone';
import { sessionsApi } from '@/utils/api';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { TZDate } from '@date-fns/tz';

import Calendar from './_calendar';

export type CalendarView = 'month' | 'week' | 'day';

export default async function Page(props: PageProps<'/calendar'>) {
  const session = await getSession();
  if (!session?.organization) {
    return null;
  }
  const { organization } = session;
  const settings = await getUserSettings();

  const { date, view: viewParam } = await props.searchParams;
  const TIMEZONE = settings.timezone ?? DEFAULT_TIMEZONE;
  const today = new TZDate(new Date(), TIMEZONE);
  const selectedDate = date ? new TZDate(date + 'T00:00:00', TIMEZONE) : today;
  const view: CalendarView = viewParam === 'week' ? 'week' : viewParam === 'month' ? 'month' : 'day';
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  // Calculate date range based on view (TZDate를 사용하면 date-fns가 타임존을 유지)
  let calendarStart: TZDate;
  let calendarEnd: TZDate;

  if (view === 'month') {
    calendarStart = startOfMonth(selectedDate) as TZDate;
    calendarEnd = endOfMonth(selectedDate) as TZDate;
  } else if (view === 'week') {
    calendarStart = startOfWeek(selectedDate, { locale: ko }) as TZDate;
    calendarEnd = endOfWeek(selectedDate, { locale: ko }) as TZDate;
  } else {
    calendarStart = startOfDay(selectedDate) as TZDate;
    calendarEnd = endOfDay(selectedDate) as TZDate;
  }

  const { data: lessons } = await sessionsApi.list({
    organizationUuids: [organization.uuid],
    dateFrom: calendarStart.toISOString(),
    dateTo: calendarEnd.toISOString(),
    limit: 100,
  });

  const serializedLessons = lessons.map(lesson => ({
    id: lesson.id,
    uuid: lesson.uuid,
    isDone: lesson.isDone,
    sessionAt: lesson.sessionAt,
    duration: lesson.duration,
    notes: lesson.notes,
    student: {
      name: lesson.student.name,
    },
  }));

  return (
    <div>
      <Calendar lessons={serializedLessons} selectedDate={selectedDateStr} view={view} use24HourFormat={settings.use24HourFormat} />
    </div>
  );
}
