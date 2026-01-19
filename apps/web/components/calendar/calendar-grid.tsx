'use client';

import clsx from 'clsx';
import {
  CalendarDate,
  startOfMonth,
  today,
  isSameDay,
  isSameMonth,
  getDayOfWeek,
} from '@internationalized/date';

interface CalendarGridProps {
  month: CalendarDate;
  value?: CalendarDate;
  onSelect: (date: CalendarDate) => void;
  minValue?: CalendarDate;
  maxValue?: CalendarDate;
  isDateUnavailable?: (date: CalendarDate) => boolean;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getCalendarDates(month: CalendarDate): CalendarDate[] {
  const monthStart = startOfMonth(month);
  const startDayOfWeek = getDayOfWeek(monthStart, 'ko-KR');
  const calendarStart = monthStart.subtract({ days: startDayOfWeek });

  const dates: CalendarDate[] = [];
  let current = calendarStart;

  for (let i = 0; i < 42; i++) {
    dates.push(current);
    current = current.add({ days: 1 });
  }

  return dates;
}

export function CalendarGrid({
  month,
  value,
  onSelect,
  minValue,
  maxValue,
  isDateUnavailable,
}: CalendarGridProps) {
  const dates = getCalendarDates(month);
  const todayDate = today('Asia/Seoul');

  const isDisabled = (date: CalendarDate): boolean => {
    if (minValue && date.compare(minValue) < 0) return true;
    if (maxValue && date.compare(maxValue) > 0) return true;
    if (isDateUnavailable?.(date)) return true;
    return false;
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className={clsx(
              'w-9 h-6 flex items-center justify-center text-xs font-medium',
              index === 0 && 'text-red-500',
              index === 6 && 'text-blue-500',
              index > 0 && index < 6 && 'text-zinc-500',
            )}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dates.map((date, index) => {
          const dayOfWeek = index % 7;
          const isSunday = dayOfWeek === 0;
          const isSaturday = dayOfWeek === 6;
          const isSelected = value ? isSameDay(date, value) : false;
          const isToday = isSameDay(date, todayDate);
          const isCurrentMonth = isSameMonth(date, month);
          const disabled = isDisabled(date);

          return (
            <button
              key={index}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelect(date)}
              className={clsx(
                'w-9 h-9 rounded-full text-sm font-normal',
                'flex items-center justify-center',
                isSelected && 'bg-accent text-accent-foreground',
                isToday && !isSelected && 'bg-primary/10',
                !isSelected && !disabled && 'hover:bg-zinc-100',
                !isCurrentMonth && !isSelected && 'opacity-40',
                !isSelected && isCurrentMonth && isSunday && 'text-red-500',
                !isSelected && isCurrentMonth && isSaturday && 'text-blue-500',
                !isSelected && isCurrentMonth && !isSunday && !isSaturday && 'text-zinc-900',
                disabled && 'opacity-40 cursor-not-allowed',
              )}
            >
              {date.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
