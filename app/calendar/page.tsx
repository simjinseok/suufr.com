import { prisma } from '@/utils/prisma';
import { createClient } from '@/utils/supabase';
import { startOfWeek } from 'date-fns/startOfWeek';
import { startOfMonth } from 'date-fns/startOfMonth';
import { addWeeks } from 'date-fns/addWeeks';

import React from 'react';
import { redirect } from 'next/navigation';
import Calendar from './_calendar';

export default async function Page({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

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
