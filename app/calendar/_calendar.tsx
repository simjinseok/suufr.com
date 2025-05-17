'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import dayGridPlugin from '@fullcalendar/daygrid';
import FullCalendar from '@fullcalendar/react';
import koLocale from '@fullcalendar/core/locales/ko';
import { format } from 'date-fns/format';

export default function Calendar({ lessons }: { lessons: any }) {
  const router = useRouter();

  const handleDatesSet = ({ start, end }) => {
    router.push(`/calendar?start=${format(start, 'yyyy-MM-dd')}&end=${format(end, 'yyyy-MM-dd')}`);
  };

  return (
    <FullCalendar
      plugins={[dayGridPlugin]}
      initialView="dayGridMonth"
      locale={koLocale}
      events={lessons.map(lesson => ({
        title: lesson.syllabus.student.name,
        date: lesson.lessonAt,
      }))}
      datesSet={handleDatesSet}
    />
  );
}
