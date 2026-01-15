'use client';
import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
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

interface WeekViewProps {
  lessons: Lesson[];
  selectedDate: Date;
  onSessionClick?: (sessionId: string) => void;
}

export default function WeekView({ lessons, selectedDate, onSessionClick }: WeekViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const weekStart = startOfWeek(selectedDate, { locale: ko });
  const weekEnd = endOfWeek(selectedDate, { locale: ko });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

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
    <div className="bg-white divide-y divide-zinc-200">
      {days.map(day => {
        const dayLessons = getLessonsForDay(day);
        const dayOfWeek = day.getDay();
        const isTodayDate = isToday(day);

        return (
          <div
            key={day.toISOString()}
            className={`flex ${isTodayDate ? 'bg-blue-50' : ''}`}
          >
            {/* Day header */}
            <button
              onClick={() => handleDayClick(day)}
              className="w-20 flex-shrink-0 py-4 px-3 flex flex-col items-center justify-center hover:bg-zinc-50 transition-colors"
            >
              <span
                className={`text-xs font-medium mb-1 ${
                  dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-zinc-400'
                }`}
              >
                {format(day, 'E', { locale: ko })}
              </span>
              <span
                className={`
                  text-lg font-semibold w-9 h-9 flex items-center justify-center rounded-full
                  ${isTodayDate ? 'bg-blue-500 text-white' : ''}
                  ${dayOfWeek === 0 && !isTodayDate ? 'text-red-500' : ''}
                  ${dayOfWeek === 6 && !isTodayDate ? 'text-blue-500' : ''}
                  ${!isTodayDate && dayOfWeek !== 0 && dayOfWeek !== 6 ? 'text-zinc-700' : ''}
                `}
              >
                {format(day, 'd')}
              </span>
            </button>

            {/* Lessons for the day */}
            <div className="flex-1 py-3 px-4 min-h-[72px] flex items-center">
              {dayLessons.length === 0 ? (
                <div className="text-sm text-zinc-300">수업 없음</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {dayLessons.map(lesson => (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSessionClick?.(lesson.id);
                      }}
                      className={`text-sm px-3 py-1.5 rounded-lg font-medium cursor-pointer hover:opacity-80 transition-opacity ${
                        lesson.isDone
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      <span>{lesson.lesson.student.name}</span>
                      <span className="text-xs ml-2 opacity-70">
                        {format(new Date(lesson.sessionAt), 'HH:mm', { in: tz(TIMEZONE) })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
