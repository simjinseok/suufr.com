'use client';

import { Calendar as HeroCalendar } from '@heroui/react';
import type { CalendarDate } from '@internationalized/date';

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
  return (
    <HeroCalendar
      value={value}
      onChange={(date) => {
        onChange?.(date as CalendarDate);
        onClose?.();
      }}
      minValue={minValue}
      maxValue={maxValue}
      isDateUnavailable={isDateUnavailable}
    >
      <HeroCalendar.Header>
        <HeroCalendar.NavButton slot="previous" />
        <HeroCalendar.Heading />
        <HeroCalendar.NavButton slot="next" />
      </HeroCalendar.Header>
      <HeroCalendar.Grid>
        <HeroCalendar.GridHeader>
          {(day) => <HeroCalendar.HeaderCell />}
        </HeroCalendar.GridHeader>
        <HeroCalendar.GridBody>
          {(date) => <HeroCalendar.Cell date={date} />}
        </HeroCalendar.GridBody>
      </HeroCalendar.Grid>
    </HeroCalendar>
  );
}
