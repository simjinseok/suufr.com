'use client';

import { useState } from 'react';
import { CalendarDate, today } from '@internationalized/date';
import { CalendarHeader } from './calendar-header';
import { CalendarGrid } from './calendar-grid';

interface CalendarProps {
  value?: CalendarDate;
  onChange?: (date: CalendarDate) => void;
  onClose?: () => void;
  minValue?: CalendarDate;
  maxValue?: CalendarDate;
  isDateUnavailable?: (date: CalendarDate) => boolean;
}

export function Calendar({
  value,
  onChange,
  onClose,
  minValue,
  maxValue,
  isDateUnavailable,
}: CalendarProps) {
  const [focusedMonth, setFocusedMonth] = useState<CalendarDate>(
    value ?? today('Asia/Seoul'),
  );

  const handlePreviousMonth = () => {
    setFocusedMonth((prev) => prev.subtract({ months: 1 }));
  };

  const handleNextMonth = () => {
    setFocusedMonth((prev) => prev.add({ months: 1 }));
  };

  const handleSelect = (date: CalendarDate) => {
    onChange?.(date);
    onClose?.();
  };

  return (
    <div className="">
      <CalendarHeader
        currentMonth={focusedMonth}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
      />
      <CalendarGrid
        month={focusedMonth}
        value={value}
        onSelect={handleSelect}
        minValue={minValue}
        maxValue={maxValue}
        isDateUnavailable={isDateUnavailable}
      />
    </div>
  );
}
