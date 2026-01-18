'use client';
import type { ZonedDateTime } from '@internationalized/date';
import { TimeField, Tooltip } from '@heroui/react';

import * as React from 'react';
import {
  Button,
  Chip,
  DateField,
  DateInputGroup,
  Label,
  Modal,
  ModalProps,
  NumberField,
  Surface,
  Tag,
  TagGroup,
} from '@heroui/react';
import { CalendarIcon, HelpCircleIcon } from 'lucide-react';
import { now, toCalendarDate } from '@internationalized/date';

import { useHourCycle, useDefaultDuration } from '@/contexts/time-format';

export interface ScheduleSettings {
  date: ZonedDateTime | null;
  count: number;
  duration: number;
  days: Set<string>;
  nextPaymentDate: ZonedDateTime | null;
}

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  onConfirm: (lessons: ZonedDateTime[], settings: ScheduleSettings) => void;
  settings?: ScheduleSettings;
}

export default function ScheduleMeetingsModal({ isOpen, onOpenChange, onConfirm, settings }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content close={close} onConfirm={onConfirm} settings={settings} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  close: () => void;
  onConfirm: (lessons: ZonedDateTime[], settings: ScheduleSettings) => void;
  settings?: ScheduleSettings;
}

function Content({ close, onConfirm, settings }: ContentProps) {
  const hourCycle = useHourCycle();
  const defaultDuration = useDefaultDuration();
  const [date, setDate] = React.useState<ZonedDateTime | null>(settings?.date ?? now('Asia/Seoul').set({ minute: 0, second: 0, millisecond: 0 }));
  const [count, setCount] = React.useState(settings?.count ?? 4);
  const [duration, setDuration] = React.useState(settings?.duration ?? defaultDuration);
  const [days, setDays] = React.useState<Set<string>>(settings?.days ?? new Set());

  const { lessons, nextPaymentDate } = React.useMemo(() => {
    if (!date || days.size === 0) return { lessons: [], nextPaymentDate: null };

    const result: ZonedDateTime[] = [];
    const selectedDays = Array.from(days).map(d => Number(d)).sort((a, b) => a - b);

    let currentDate = date;
    let nextPayment: ZonedDateTime | null = null;

    // count개 수업 + 다음결제예정일(count+1번째)까지 계산
    while (nextPayment === null) {
      const dayOfWeek = currentDate.toDate().getDay();

      if (selectedDays.includes(dayOfWeek)) {
        if (result.length < count) {
          result.push(currentDate);
        } else {
          // count + 1번째는 다음결제예정일
          nextPayment = currentDate;
        }
      }

      currentDate = currentDate.add({ days: 1 });
    }

    return { lessons: result, nextPaymentDate: nextPayment };
  }, [date, count, days]);

  const handleConfirm = () => {
    onConfirm(lessons, { date, count, duration, days, nextPaymentDate });
    close();
  };

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>수업 일정 추가</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Surface className="p-3 flex flex-col gap-3 rounded-xl">
          <div className="flex gap-3">
            <DateField
              value={date ? toCalendarDate(date) : null}
              granularity="day"
              onChange={(newDate) => {
                if (newDate) {
                  setDate(prev => prev?.set({ year: newDate.year, month: newDate.month, day: newDate.day }) ?? null);
                }
              }}
              hideTimeZone
            >
              <Label>기준 날짜</Label>
              <DateInputGroup>
                <DateInputGroup.Prefix>
                  <CalendarIcon className="size-4" />
                </DateInputGroup.Prefix>
                <DateInputGroup.Input>
                  {segment => <DateInputGroup.Segment segment={segment} />}
                </DateInputGroup.Input>
              </DateInputGroup>
            </DateField>
            <TimeField hourCycle={hourCycle} granularity="minute" value={date} onChange={setDate} hideTimeZone>
              <Label>시간</Label>
              <DateInputGroup>
                <DateInputGroup.Input>
                  {segment => <DateInputGroup.Segment segment={segment} />}
                </DateInputGroup.Input>
              </DateInputGroup>
            </TimeField>
          </div>

          <div className="flex gap-3">
            <NumberField value={duration} minValue={5} step={5} onChange={value => setDuration(value)}>
              <Label>수업 시간 (분)</Label>
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input className="w-14 text-center" />
                <NumberField.IncrementButton />
              </NumberField.Group>
            </NumberField>
            <NumberField value={count} minValue={1} maxValue={20} onChange={value => setCount(value)}>
              <Label>수업 횟수</Label>
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input className="w-10 text-center" />
                <NumberField.IncrementButton />
              </NumberField.Group>
            </NumberField>
          </div>

          <TagGroup size="lg" selectionMode="multiple" selectedKeys={days} onSelectionChange={setDays as any}>
            <Label>요일</Label>
            <TagGroup.List>
              <Tag id="0" textValue="0">일</Tag>
              <Tag id="1" textValue="1">월</Tag>
              <Tag id="2" textValue="2">화</Tag>
              <Tag id="3" textValue="3">수</Tag>
              <Tag id="4" textValue="4">목</Tag>
              <Tag id="5" textValue="5">금</Tag>
              <Tag id="6" textValue="6">토</Tag>
            </TagGroup.List>
          </TagGroup>
        </Surface>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={close}>취소</Button>
        <Button variant="primary" isDisabled={lessons.length === 0} onClick={handleConfirm}>
          확인 (
          {lessons.length}
          개)
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
