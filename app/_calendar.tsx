'use client';
import React from 'react';
import dayGridPlugin from '@fullcalendar/daygrid';
import FullCalendar from '@fullcalendar/react';
import koLocale from '@fullcalendar/core/locales/ko';

export default function Calendar({ lessons }: { lessons: any }) {
  return (
    <FullCalendar
      plugins={[dayGridPlugin]}
      initialView="dayGridMonth"
      locale={koLocale}
      events={lessons.map(lesson => ({
        title: lesson.syllabus.student.name,
        date: lesson.lessonAt,
      }))}
    />
  );
}
