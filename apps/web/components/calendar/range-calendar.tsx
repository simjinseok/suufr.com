'use client';

import { RangeCalendar as HeroRangeCalendar } from '@heroui/react';
import type { CalendarDate } from '@internationalized/date';

export interface DateRange {
  start: CalendarDate;
  end: CalendarDate;
}

interface RangeCalendarProps {
  'value'?: DateRange | null;
  'onChange'?: (range: DateRange) => void;
  'minValue'?: CalendarDate;
  'maxValue'?: CalendarDate;
  'aria-label'?: string;
}

export function RangeCalendar({ value, onChange, minValue, maxValue, ...rest }: RangeCalendarProps) {
  return (
    <HeroRangeCalendar
      value={value}
      onChange={(range) => range && onChange?.(range as DateRange)}
      minValue={minValue}
      maxValue={maxValue}
      {...rest}
    >
      <HeroRangeCalendar.Header>
        <HeroRangeCalendar.NavButton slot="previous" />
        <HeroRangeCalendar.Heading className="text-center" />
        <HeroRangeCalendar.NavButton slot="next" />
      </HeroRangeCalendar.Header>
      <HeroRangeCalendar.Grid>
        <HeroRangeCalendar.GridHeader>
          {() => <HeroRangeCalendar.HeaderCell />}
        </HeroRangeCalendar.GridHeader>
        <HeroRangeCalendar.GridBody>
          {(date) => <HeroRangeCalendar.Cell date={date} />}
        </HeroRangeCalendar.GridBody>
      </HeroRangeCalendar.Grid>
    </HeroRangeCalendar>
  );
}
