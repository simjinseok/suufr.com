'use client';
import type { ModalProps } from '@heroui/react';
import type { CalendarDate, CalendarDateTime } from '@internationalized/date';
import type { TInvoice } from '@/types/index';

import * as React from 'react';
import {
  Button,
  Chip,
  DateField,
  DatePicker,
  Form,
  Label,
  Modal,
  NumberField,
  Surface,
  Tag,
  TagGroup,
  TimeField,
  toast,
} from '@heroui/react';
import { parseDate, parseTime, toCalendarDateTime, today } from '@internationalized/date';
import { format } from 'date-fns/format';
import { ko } from 'date-fns/locale/ko';
import { tz } from '@date-fns/tz';
import { useRouter } from 'next/navigation';

import { Calendar } from '@/components/calendar';
import { createSessionsBulk } from '@/actions/session';
import { useHourCycle, useDefaultDuration } from '@/contexts/time-format';
import { useTimeZone } from '@/contexts/timezone';

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 요일 순회 안전 상한 (일)
const MAX_SCAN_DAYS = 400;
// 한 번에 만들 수 있는 수업 수 (서버 MAX_BULK_SESSIONS와 동일)
const MAX_COUNT = 50;

interface Props {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  studentUuid: string;
  invoice: TInvoice;
  use24HourFormat: boolean;
}

// 기준날짜부터 선택한 요일·시간에 횟수만큼 수업을 만든다.
export default function GenerateSessionsModal({
  isOpen,
  onOpenChange,
  studentUuid,
  invoice,
  use24HourFormat,
}: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content
              close={close}
              studentUuid={studentUuid}
              invoice={invoice}
              use24HourFormat={use24HourFormat}
            />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  close: () => void;
  studentUuid: string;
  invoice: TInvoice;
  use24HourFormat: boolean;
}
function Content({ close, studentUuid, invoice, use24HourFormat }: ContentProps) {
  const timeZone = useTimeZone();
  const formId = React.useId();
  const router = useRouter();
  const hourCycle = useHourCycle();
  const defaultDuration = useDefaultDuration();

  // 기준날짜 기본값: 수강권 기간의 시작 (없으면 오늘). @db.Date라 UTC 자정으로 직렬화되므로 날짜 부분만 쓴다.
  const [startDate, setStartDate] = React.useState<CalendarDate>(
    () => (invoice.periodStart ? parseDate(invoice.periodStart.slice(0, 10)) : today(timeZone)),
  );

  const [days, setDays] = React.useState<Set<string>>(() => new Set());
  const [time, setTime] = React.useState(() => parseTime('16:00'));
  const [count, setCount] = React.useState(4);
  const [duration, setDuration] = React.useState(defaultDuration);

  // 미리보기 = 실제로 생성될 목록 (그대로 서버에 보낸다).
  // 한 번 더 계산해 다음 회차(= 다음 결제 예정일)까지 구한다.
  const { occurrences, nextPayment } = React.useMemo(() => {
    if (days.size === 0 || count < 1) return { occurrences: [], nextPayment: null };

    const selectedDays = new Set(Array.from(days, Number));
    const result: CalendarDateTime[] = [];
    let cursor = startDate;

    for (let day = 0; day < MAX_SCAN_DAYS && result.length <= count; day++) {
      // 달력 날짜의 요일은 타임존과 무관 — UTC 자정 instant + getUTCDay로 결정적으로 계산
      if (selectedDays.has(cursor.toDate('UTC').getUTCDay())) {
        result.push(toCalendarDateTime(cursor, time));
      }
      cursor = cursor.add({ days: 1 });
    }

    return { occurrences: result.slice(0, count), nextPayment: result[count] ?? null };
  }, [startDate, days, time, count]);

  const [state, formAction, isPending] = React.useActionState(createSessionsBulk, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      toast.success(state.message ?? '수업을 만들었습니다', { timeout: 3000 });
      router.refresh();
      close();
    }
    else if (state.message) {
      toast.danger(state.message, { timeout: 3000 });
    }
  }, [state.success, state.timestamp, state.message]);

  return (
    <React.Fragment>
      <Modal.CloseTrigger />

      <Modal.Header>
        <Modal.Heading>수업 만들기</Modal.Heading>
      </Modal.Header>

      <Modal.Body>
        <Form id={formId} className="p-1 flex flex-col gap-4" action={formAction}>
          <input type="hidden" name="studentUuid" value={studentUuid} />
          <input type="hidden" name="invoiceUuid" value={invoice.uuid} />
          <input type="hidden" name="duration" value={duration} />
          <input
            type="hidden"
            name="sessions"
            value={JSON.stringify(occurrences.map(o => o.toString()))}
          />
          {/* 마지막 수업 다음 회차 → 다음 결제 예정일 (설정에 따라 서버가 반영) */}
          {nextPayment && (
            <input type="hidden" name="nextPaymentAt" value={nextPayment.toString().slice(0, 10)} />
          )}

          <Surface className="p-3 flex flex-col gap-3 rounded-xl">
            <div className="flex flex-wrap gap-3">
              <DatePicker
                className="w-fit"
                value={startDate}
                granularity="day"
                onChange={v => v && setStartDate(v)}
                hideTimeZone
              >
                <Label>기준날짜</Label>
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

              <NumberField
                variant="secondary"
                value={count}
                minValue={1}
                maxValue={MAX_COUNT}
                onChange={value => setCount(value)}
              >
                <Label>횟수</Label>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input className="w-12 text-center" />
                  <NumberField.IncrementButton />
                </NumberField.Group>
              </NumberField>
            </div>

            <TagGroup
              size="lg"
              selectionMode="multiple"
              selectedKeys={days}
              onSelectionChange={keys => setDays(new Set(keys as Set<string>))}
            >
              <Label>요일</Label>
              <TagGroup.List>
                {DAY_LABELS.map((label, day) => (
                  <Tag key={day} id={String(day)} textValue={label}>{label}</Tag>
                ))}
              </TagGroup.List>
            </TagGroup>

            <div className="flex flex-wrap gap-3">
              <TimeField
                hourCycle={hourCycle}
                granularity="minute"
                value={time}
                onChange={v => v && setTime(v)}
              >
                <Label>시간</Label>
                <DateField.Group variant="secondary">
                  <DateField.Input>
                    {segment => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                </DateField.Group>
              </TimeField>

              <NumberField
                variant="secondary"
                value={duration}
                minValue={5}
                step={5}
                onChange={value => setDuration(value)}
              >
                <Label>수업 시간 (분)</Label>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input className="w-14 text-center" />
                  <NumberField.IncrementButton />
                </NumberField.Group>
              </NumberField>
            </div>
          </Surface>

          {occurrences.length > 0
            ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">
                    생성될 수업
                    {' '}
                    <span className="text-gray-500">
                      (
                      {occurrences.length}
                      개)
                    </span>
                  </p>
                  <Surface variant="secondary" className="p-2 rounded-xl max-h-64 overflow-y-auto">
                    {/* 열 폭은 각 열의 최댓값에 맞춰 자동 정렬 ("3일"/"13일"처럼 글자 수가 달라도 어긋나지 않는다) */}
                    <ul className="grid grid-cols-[auto_auto_auto_1fr] items-center gap-x-2">
                      {occurrences.map((occurrence, index) => {
                        const date = occurrence.toDate(timeZone);
                        return (
                          <li
                            key={occurrence.toString()}
                            className={`col-span-4 grid grid-cols-subgrid items-center py-1.5 tabular-nums ${index > 0 ? 'border-t border-gray-100' : ''}`}
                          >
                            <span className="font-medium text-gray-900">
                              {format(date, 'M월 d일', { locale: ko, in: tz(timeZone) })}
                            </span>
                            <Chip size="sm" variant="soft">
                              {format(date, 'E', { locale: ko, in: tz(timeZone) })}
                            </Chip>
                            <span className="text-sm text-gray-600">
                              {format(date, use24HourFormat ? 'HH:mm' : 'a h:mm', { locale: ko, in: tz(timeZone) })}
                            </span>
                            <span className="text-xs text-gray-400">
                              ·
                              {' '}
                              {duration}
                              분
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </Surface>
                </div>
              )
            : (
                <Surface variant="secondary" className="p-4 rounded-xl text-center text-sm text-gray-500">
                  요일을 선택하면 만들어질 수업이 표시됩니다
                </Surface>
              )}
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          isPending={isPending}
          isDisabled={occurrences.length === 0}
        >
          수업 생성
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
