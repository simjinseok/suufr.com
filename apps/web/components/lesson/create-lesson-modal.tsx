'use client';
import type { ZonedDateTime } from '@internationalized/date';
import { Description, ModalProps, Popover, TimeField, Tooltip } from '@heroui/react';

import * as React from 'react';
import {
  Button,
  Chip,
  DateField,
  DateInputGroup,
  Form,
  Input,
  Label,
  Modal,
  NumberField,
  Surface,
  Tag,
  TagGroup,
  TextArea,
  TextField,
} from '@heroui/react';
import { CalendarIcon, HelpCircleIcon } from 'lucide-react';
import { now, toCalendarDate } from '@internationalized/date';

import { createLesson } from '@/actions/lesson';
import { useHourCycle, useDefaultDuration } from '@/contexts/time-format';
import Stepper from '@/components/stepper';
import { Calendar } from '@/components/calendar';

interface Props {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  studentUuid: string;
}
export default function CreateLessonModal({ isOpen, onOpenChange, studentUuid }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content studentUuid={studentUuid} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

const STEPS = [
  { label: '레슨 정보' },
  { label: '수업 일정' },
];

interface ContentProps {
  studentUuid: string;
  close: () => void;
}
function Content({ close, studentUuid }: ContentProps) {
  const formId = React.useId();
  const hourCycle = useHourCycle();
  const defaultDuration = useDefaultDuration();

  const [currentStep, setCurrentStep] = React.useState(0);

  // Step 2 data
  const [date, setDate] = React.useState<ZonedDateTime | null>(
    now('Asia/Seoul').set({ minute: 0, second: 0, millisecond: 0 }),
  );
  const [count, setCount] = React.useState(4);
  const [duration, setDuration] = React.useState(defaultDuration);
  const [days, setDays] = React.useState<Set<string>>(new Set());

  const { lessons, nextPaymentDate } = React.useMemo(() => {
    if (!date || days.size === 0) return { lessons: [], nextPaymentDate: null };

    const result: ZonedDateTime[] = [];
    const selectedDays = Array.from(days).map(d => Number(d)).sort((a, b) => a - b);

    let currentDate = date;
    let nextPayment: ZonedDateTime | null = null;

    while (nextPayment === null) {
      const dayOfWeek = currentDate.toDate().getDay();

      if (selectedDays.includes(dayOfWeek)) {
        if (result.length < count) {
          result.push(currentDate);
        }
        else {
          nextPayment = currentDate;
        }
      }

      currentDate = currentDate.add({ days: 1 });
    }

    return { lessons: result, nextPaymentDate: nextPayment };
  }, [date, count, days]);

  const [state, formAction, isPending] = React.useActionState(createLesson, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert(state.message);
      close();
    }
  }, [state.success, state.timestamp, state.message]);

  return (
    <>
      <Modal.Header>
        <Modal.Heading>레슨 추가</Modal.Heading>
        <Stepper steps={STEPS} currentStep={currentStep} />
      </Modal.Header>

      <Modal.Body>
        <Form id={formId} className="mt-4 p-1 flex flex-col gap-4" action={formAction}>
          <input type="hidden" name="studentUuid" value={studentUuid} />

          {lessons.length > 0 && (
            <>
              <input type="hidden" name="lessonDuration" value={duration} />
              <input type="hidden" name="nextPaymentAt" value={nextPaymentDate?.toString() ?? ''} />
              {lessons.map((lesson, idx) => (
                <input
                  key={`lesson-hidden-${idx}`}
                  type="hidden"
                  name={`lesson[${idx}]`}
                  value={lesson.toString()}
                />
              ))}
            </>
          )}

          {/* Step 1: 레슨 정보 */}
          <div className="flex flex-col gap-4" hidden={currentStep !== 0}>
            <TextField name="title">
              <Label>제목</Label>
              <Input />
            </TextField>

            <TextField name="notes">
              <Label>내용</Label>
              <TextArea placeholder="레슨 내용" />
              <Description>레슨 내용을 입력해보세요. 수강생에겐 보여지지 않습니다.</Description>
            </TextField>
          </div>

          {/* Step 2: 수업 일정 */}
          <div className="flex flex-col gap-4" hidden={currentStep !== 1}>
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
                  <div className="flex items-center gap-1">
                    <Popover>
                      <Button
                        className="rounded-field"
                        size="sm"
                        isIconOnly
                        variant="tertiary"
                      >
                        <CalendarIcon className="size-4" />
                      </Button>
                      <Popover.Content>
                        <Popover.Dialog>
                          <Calendar
                            value={date ? toCalendarDate(date) : null}
                            onChange={(newDate) => {
                              if (newDate) {
                                setDate(prev => prev?.set({ year: newDate.year, month: newDate.month, day: newDate.day }) ?? null);
                              }
                            }}
                          />
                        </Popover.Dialog>
                      </Popover.Content>
                    </Popover>
                    <DateInputGroup>
                      <DateInputGroup.Input>
                        {segment => <DateInputGroup.Segment segment={segment} />}
                      </DateInputGroup.Input>
                    </DateInputGroup>
                  </div>
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

            {lessons.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium">생성될 수업</p>
                  <Tooltip delay={100}>
                    <Tooltip.Trigger>
                      <HelpCircleIcon strokeWidth={1.5} className="size-4 text-default-400" />
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="bottom" className="p-4">
                      <Tooltip.Arrow />
                      선택한 조건에 따라 자동 계산된 수업 일정입니다.
                    </Tooltip.Content>
                  </Tooltip>
                </div>
                <Surface className="p-2 flex flex-col gap-1 rounded-xl" variant="secondary">
                  {lessons.map((lesson, idx) => (
                    <DateField
                      key={`lesson-preview-${lesson.toString()}`}
                      aria-label={`${idx + 1}번째 수업`}
                      className="tabular-nums"
                      value={lesson}
                      hourCycle={hourCycle}
                      isReadOnly
                      hideTimeZone
                    >
                      <DateInputGroup>
                        <DateInputGroup.Input>
                          {segment => <DateInputGroup.Segment segment={segment} />}
                        </DateInputGroup.Input>
                        <DateInputGroup.Suffix>
                          <Chip color="accent">{lesson.toDate().toLocaleDateString('ko-KR', { weekday: 'long' })}</Chip>
                        </DateInputGroup.Suffix>
                      </DateInputGroup>
                    </DateField>
                  ))}
                </Surface>
              </div>
            )}

            {lessons.length === 0 && (
              <Surface className="p-4 rounded-xl text-center text-sm text-default-500" variant="secondary">
                요일을 선택하면 수업 일정이 표시됩니다
              </Surface>
            )}
          </div>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <React.Activity mode={currentStep === 0 ? 'visible' : 'hidden'}>
          <Button variant="ghost" onPress={close}>닫기</Button>
          <Button variant="primary" onPress={() => setCurrentStep(1)}>다음</Button>
        </React.Activity>
        <React.Activity mode={currentStep === 1 ? 'visible' : 'hidden'}>
          <Button variant="ghost" isDisabled={isPending} onPress={() => setCurrentStep(0)}>이전</Button>
          <Button
            variant="primary"
            isPending={isPending}
            type="submit"
            form={formId}
          >
            {lessons.length > 0 ? `저장 (${lessons.length}개)` : '일정 없이 저장'}
          </Button>
        </React.Activity>
      </Modal.Footer>
    </>
  );
}
