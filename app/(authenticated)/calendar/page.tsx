import prisma from '@/utils/prisma';
import { getSession } from '@/utils/auth';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { TZDate } from '@date-fns/tz';

import React from 'react';
import Calendar from './_calendar';

export type CalendarView = 'month' | 'week' | 'day';

export default async function Page(props: PageProps<'/calendar'>) {
  const { user } = await getSession();

  const { date, view: viewParam } = await props.searchParams;
  const TIMEZONE = 'Asia/Seoul';
  const today = new TZDate(new Date(), TIMEZONE);
  const selectedDate = date ? new TZDate(date + 'T00:00:00', TIMEZONE) : today;
  const view: CalendarView = viewParam === 'week' ? 'week' : viewParam === 'day' ? 'day' : 'month';
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

  const lessons = await prisma.session.findMany({
    select: {
      id: true,
      isDone: true,
      sessionAt: true,
      notes: true,
      lesson: {
        select: {
          student: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    where: {
      sessionAt: {
        gte: calendarStart,
        lte: calendarEnd,
      },
      deletedAt: null,
      lesson: {
        student: {
          userId: user.id,
        },
      },
    },
    orderBy: {
      sessionAt: 'asc',
    },
  });

  const serializedLessons = lessons.map(lesson => ({
    ...lesson,
    sessionAt: lesson.sessionAt.toISOString(),
  }));

  return (
    <div>
      <Calendar lessons={serializedLessons} selectedDate={selectedDateStr} view={view} />
    </div>
  );
}
