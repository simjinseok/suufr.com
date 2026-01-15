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
  const today = new TZDate(new Date(), 'Asia/Seoul');
  const selectedDate = date ? new Date(date + 'T00:00:00+09:00') : today;
  const view: CalendarView = viewParam === 'week' ? 'week' : viewParam === 'day' ? 'day' : 'month';
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  // Calculate date range based on view
  let calendarStart: Date;
  let calendarEnd: Date;

  if (view === 'month') {
    calendarStart = startOfMonth(selectedDate);
    calendarEnd = endOfMonth(selectedDate);
  } else if (view === 'week') {
    calendarStart = startOfWeek(selectedDate, { locale: ko });
    calendarEnd = endOfWeek(selectedDate, { locale: ko });
  } else {
    calendarStart = startOfDay(selectedDate);
    calendarEnd = endOfDay(selectedDate);
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
