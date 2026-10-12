'use client';

import * as React from 'react';
import { Button, DateField, DatePicker, Description, Label } from '@heroui/react';
import { XIcon } from 'lucide-react';
import { parseDate, type CalendarDate } from '@internationalized/date';

import { Calendar } from '@/components/calendar';

export type InvoicePeriod = {
  start: CalendarDate;
  /** null 이면 종료일 없음(무기한) */
  end: CalendarDate | null;
};

interface Props {
  value: InvoicePeriod;
  onChange: (value: InvoicePeriod) => void;
}

/** API 의 @db.Date 는 "YYYY-MM-DDT00:00:00.000Z" 로 내려온다 — 날짜 부분만 쓴다 */
export function periodFromInvoice(periodStart: string, periodEnd: string | null): InvoicePeriod {
  return {
    start: parseDate(periodStart.slice(0, 10)),
    end: periodEnd ? parseDate(periodEnd.slice(0, 10)) : null,
  };
}

/**
 * 수강 시작일(필수) + 종료일(선택) 입력. 수업 날짜와 헷갈리지 않도록 "기간" 범위 피커 대신
 * 날짜 둘을 따로 받는다. periodStart 는 항상, periodEnd 는 값이 있을 때만 hidden input 으로 폼에 싣는다.
 */
export function InvoicePeriodFields({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="periodStart" value={value.start.toString()} />
      {value.end && <input type="hidden" name="periodEnd" value={value.end.toString()} />}

      <DatePicker
        value={value.start}
        granularity="day"
        onChange={start => start && onChange({ ...value, start })}
        hideTimeZone
        isRequired
      >
        <Label>수강 시작일</Label>
        <DateField.Group variant="secondary">
          <DateField.Input>
            {segment => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover placement="bottom left" className="min-w-fit">
          <Calendar />
        </DatePicker.Popover>
      </DatePicker>

      <DatePicker
        value={value.end}
        granularity="day"
        minValue={value.start}
        onChange={end => onChange({ ...value, end })}
        hideTimeZone
      >
        <Label>종료일</Label>
        <DateField.Group variant="secondary">
          <DateField.Input>
            {segment => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateField.Suffix className="gap-1">
            {value.end && (
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label="종료일 지우기"
                onPress={() => onChange({ ...value, end: null })}
              >
                <XIcon className="size-4" />
              </Button>
            )}
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <Description>비워 두면 다음 수강권이 시작할 때까지 계속 적용됩니다.</Description>
        <DatePicker.Popover placement="bottom left" className="min-w-fit">
          {/* 래퍼 Calendar 가 minValue 를 명시 prop 으로 넘겨 DatePicker 컨텍스트 값을 덮어쓴다 — 직접 전달 */}
          <Calendar minValue={value.start} />
        </DatePicker.Popover>
      </DatePicker>
    </div>
  );
}
