'use client';
import React from 'react';
import { formatTime } from '@/utils/time-format';
import type { TimeFormat } from '@/types/index';

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

interface DayViewProps {
  lessons: Lesson[];
  onSessionClick?: (sessionId: string) => void;
  timeFormat: TimeFormat;
}

export default function DayView({ lessons, onSessionClick, timeFormat }: DayViewProps) {
  if (lessons.length === 0) {
    return (
      <div className="py-12 text-center text-zinc-400 bg-white">
        예정된 수업이 없습니다
      </div>
    );
  }

  return (
    <div className="bg-white divide-y divide-zinc-200">
      {lessons.map(lesson => (
        <button
          key={lesson.id}
          type="button"
          onClick={() => onSessionClick?.(lesson.id)}
          className="w-full flex items-center gap-4 py-4 px-4 hover:bg-zinc-50 transition-colors text-left cursor-pointer"
        >
          {/* Time */}
          <div className="w-20 text-sm font-medium text-zinc-500 flex-shrink-0">
            {formatTime(lesson.sessionAt, timeFormat)}
          </div>

          {/* Status indicator */}
          <div
            className={`w-1 h-10 rounded-full flex-shrink-0 ${
              lesson.isDone ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-zinc-900">
              {lesson.lesson.student.name}
            </div>
            {lesson.notes && (
              <div className="text-sm text-zinc-500 truncate mt-0.5">
                {lesson.notes}
              </div>
            )}
          </div>

          {/* Status badge */}
          <div
            className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
              lesson.isDone
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {lesson.isDone ? '완료' : '예정'}
          </div>
        </button>
      ))}
    </div>
  );
}
