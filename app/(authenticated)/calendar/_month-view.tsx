'use client';
import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { tz } from '@date-fns/tz';

const TIMEZONE = 'Asia/Seoul';

interface Lesson {
  id: string;
  sessionAt: string;
  isDone: boolean;
  notes: string | null;
  lesson: {
    student: {
      name: string;
    };
  };
}

interface MonthViewProps {
  lessons: Lesson[];
  selectedDate: Date;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function MonthView({ lessons, selectedDate }: MonthViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { locale: ko });
  const calendarEnd = endOfWeek(monthEnd, { locale: ko });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getLessonsForDay = (day: Date) => {
    return lessons.filter(lesson => isSameDay(new Date(lesson.sessionAt), day, { in: tz(TIMEZONE) }));
  };

  const handleDayClick = (day: Date) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', format(day, 'yyyy-MM-dd'));
    params.set('view', 'day');
    router.push(`/calendar?${params.toString()}`);
  };

  return (
    <div className="flex flex-col bg-white">
      {/* Weekday header */}
      <div className="grid grid-cols-7 bg-zinc-50 border-b border-zinc-200">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={`py-3 text-center text-xs font-medium uppercase tracking-wider ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-zinc-500'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayLessons = getLessonsForDay(day);
          const isCurrentMonth = isSameMonth(day, selectedDate);
          const dayOfWeek = day.getDay();
          const rowIndex = Math.floor(index / 7);
          const totalRows = Math.ceil(days.length / 7);
          const isLastRow = rowIndex === totalRows - 1;

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              className={`
                min-h-[90px] p-2 text-left transition-colors
                ${!isLastRow ? 'border-b border-zinc-200' : ''}
                ${dayOfWeek !== 6 ? 'border-r border-zinc-200' : ''}
                ${isCurrentMonth ? 'bg-white hover:bg-zinc-50' : 'bg-zinc-50 hover:bg-zinc-100'}
              `}
            >
              <span
                className={`
                  text-sm w-7 h-7 flex items-center justify-center rounded-full mb-1
                  ${isToday(day) ? 'bg-blue-500 text-white font-semibold' : ''}
                  ${!isCurrentMonth && !isToday(day) ? 'text-zinc-300' : ''}
                  ${dayOfWeek === 0 && isCurrentMonth && !isToday(day) ? 'text-red-500' : ''}
                  ${dayOfWeek === 6 && isCurrentMonth && !isToday(day) ? 'text-blue-500' : ''}
                  ${isCurrentMonth && !isToday(day) && dayOfWeek !== 0 && dayOfWeek !== 6 ? 'text-zinc-700' : ''}
                `}
              >
                {format(day, 'd')}
              </span>

              {/* Lesson indicators */}
              <div className="space-y-1">
                {dayLessons.slice(0, 2).map(lesson => (
                  <div
                    key={lesson.id}
                    className={`
                      text-xs px-1.5 py-0.5 rounded truncate font-medium
                      ${lesson.isDone
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-100 text-blue-700'}
                    `}
                  >
                    {lesson.lesson.student.name}
                  </div>
                ))}
                {dayLessons.length > 2 && (
                  <div className="text-xs text-zinc-400 px-1">
                    +{dayLessons.length - 2}개
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
