import prisma from '@/utils/prisma';
import { getSession } from '@/utils/auth';
import { startOfWeek } from 'date-fns/startOfWeek';
import { startOfMonth } from 'date-fns/startOfMonth';
import { addWeeks } from 'date-fns/addWeeks';

import React from 'react';
import Calendar from './_calendar';

export default async function Page({ searchParams }) {
  const { user } = await getSession();

  const { start, end } = await searchParams;
  const calendarStart = start ? new Date(start) : startOfWeek(startOfMonth(new Date()), { weekStartsOn: 0 });
  const calendarEnd = end ? new Date(end) : addWeeks(calendarStart, 6);

  const lessons = await prisma.lesson.findMany({
    select: {
      id: true,
      isDone: true,
      lessonAt: true,
      notes: true,
      syllabus: {
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
      lessonAt: {
        gte: calendarStart,
        lt: calendarEnd,
      },
      deletedAt: null,
      syllabus: {
        student: {
          userId: user.id,
        },
      },
    },
  });

  return (
    <div>
      <Calendar lessons={lessons} />
    </div>
  );
}
