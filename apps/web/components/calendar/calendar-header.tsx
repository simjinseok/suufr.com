'use client';

import { Button } from '@heroui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarDate } from '@internationalized/date';

interface CalendarHeaderProps {
  currentMonth: CalendarDate;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

export function CalendarHeader({
  currentMonth,
  onPreviousMonth,
  onNextMonth,
}: CalendarHeaderProps) {
  const year = currentMonth.year;
  const month = currentMonth.month;

  return (
    <div className="flex items-center justify-between mb-4">
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        onPress={onPreviousMonth}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      <h2 className="text-sm font-medium text-zinc-900">
        {year}년 {month}월
      </h2>

      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        onPress={onNextMonth}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
