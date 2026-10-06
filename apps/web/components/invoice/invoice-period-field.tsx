'use client';

import * as React from 'react';
import { Checkbox, DateField, DateRangePicker, Label } from '@heroui/react';
import { parseDate, today, type CalendarDate } from '@internationalized/date';

import { RangeCalendar, type DateRange } from '@/components/calendar';
import { useTimeZone } from '@/contexts/timezone';

interface Props {
  /** null 이면 기간 없음 */
  value: DateRange | null;
  onChange: (value: DateRange | null) => void;
}

/** 시작일 기준 1개월 (시작일 포함, 다음 달 같은 날 전날까지) */
export function defaultPeriod(start: CalendarDate): DateRange {
  return { start, end: start.add({ months: 1 }).subtract({ days: 1 }) };
}

/** API 의 @db.Date 는 "YYYY-MM-DDT00:00:00.000Z" 로 내려온다 — 날짜 부분만 쓴다 */
export function periodFromInvoice(periodStart: string | null, periodEnd: string | null): DateRange | null {
  if (!periodStart || !periodEnd) return null;
  return { start: parseDate(periodStart.slice(0, 10)), end: parseDate(periodEnd.slice(0, 10)) };
}

/**
 * 수강권 기간 입력. 라벨 줄 오른쪽 체크박스로 켜고 끄며,
 * 켜져 있을 때만 범위 피커와 periodStart/periodEnd hidden input 을 폼에 싣는다.
 * 꺼도 직전 범위를 기억해 다시 켜면 그대로 복원된다.
 */
export function InvoicePeriodField({ value, onChange }: Props) {
  const timeZone = useTimeZone();
  const lastRange = React.useRef<DateRange | null>(value);
  if (value) lastRange.current = value;

  const enabled = value !== null;

  const toggle = (checked: boolean) => {
    onChange(checked ? (lastRange.current ?? defaultPeriod(today(timeZone))) : null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>기간설정</Label>
        <Checkbox
          isSelected={enabled}
          onChange={toggle}
          variant="secondary"
          aria-label="기간설정 사용"
        >
          <Checkbox.Content>
            <Checkbox.Control className="size-5">
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Content>
        </Checkbox>
      </div>

      {value && (
        <>
          <input type="hidden" name="periodStart" value={value.start.toString()} />
          <input type="hidden" name="periodEnd" value={value.end.toString()} />

          <DateRangePicker
            aria-label="수강권 기간"
            value={value}
            granularity="day"
            onChange={(range) => range && onChange(range as DateRange)}
            hideTimeZone
          >
            <DateField.Group variant="secondary">
              <DateField.InputContainer>
                <DateField.Input slot="start">
                  {segment => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateRangePicker.RangeSeparator />
                <DateField.Input slot="end">
                  {segment => <DateField.Segment segment={segment} />}
                </DateField.Input>
              </DateField.InputContainer>
              <DateField.Suffix>
                <DateRangePicker.Trigger>
                  <DateRangePicker.TriggerIndicator />
                </DateRangePicker.Trigger>
              </DateField.Suffix>
            </DateField.Group>
            <DateRangePicker.Popover placement="bottom left" className="min-w-fit">
              <RangeCalendar aria-label="수강권 기간 선택" />
            </DateRangePicker.Popover>
          </DateRangePicker>
        </>
      )}

      <p className="text-xs text-default-500">
        {enabled
          ? '이 기간에 추가하는 수업은 자동으로 이 수강권에 묶여요.'
          : '기간을 정하지 않으면 수업을 직접 연결해야 해요.'}
      </p>
    </div>
  );
}
