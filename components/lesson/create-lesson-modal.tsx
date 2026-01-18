'use client';
import type { ZonedDateTime } from '@internationalized/date';
import { Description, ModalProps, Tooltip } from '@heroui/react';

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
  Surface,
  TextArea,
  TextField,
} from '@heroui/react';
import { CalendarPlusIcon, HelpCircleIcon } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';

import { createLesson } from '@/actions/lesson';
import { useHourCycle } from '@/contexts/time-format';
import ScheduleMeetingsModal, { type ScheduleSettings } from './schedule-meetings-modal';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  studentId: string;
}
export default function CreateLessonModal({ isOpen, onOpenChange, studentId }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content studentId={studentId} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  studentId: string;
  close: () => void;
}
function Content({ close, studentId }: ContentProps) {
  const formId = React.useId();
  const hourCycle = useHourCycle();
  const [scheduledLessons, setScheduledLessons] = React.useState<ZonedDateTime[]>([]);
  const [scheduleSettings, setScheduleSettings] = React.useState<ScheduleSettings | undefined>();
  const [isScheduleModalOpen, setIsScheduleModalOpen] = React.useState(false);

  const handleScheduleConfirm = (lessons: ZonedDateTime[], settings: ScheduleSettings) => {
    setScheduledLessons(lessons);
    setScheduleSettings(settings);
  };

  const [state, formAction, isPending] = React.useActionState(createLesson, {
    fields: {
      title: '',
      notes: '',
    },
  });
  const { control } = useForm({
    values: {
      title: state.fields?.title,
      notes: state.fields?.notes,
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert(state.message);
      close();
    }
  }, [state.success, state.timestamp, state.message]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>레슨 추가</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form id={formId} className="mt-4 p-1 flex flex-col gap-4" action={formAction}>
          <input type="hidden" name="studentId" value={studentId} />

          <Controller
            control={control}
            name="title"
            render={({ field: { name, value, onChange } }) => (
              <TextField
                name={name}
                value={value}
                onInput={(event) => {
                  onChange(event.currentTarget.value);
                }}
              >
                <Label>제목</Label>
                <Input />
              </TextField>
            )}
          />

          <Controller
            control={control}
            name="notes"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onInput={event => onChange(event.currentTarget.value)}>
                <Label>
                  내용
                </Label>
                <TextArea placeholder="레슨 내용" />
                <Description>레슨 내용을 입력해보세요. 수강생에겐 보여지지 않습니다.</Description>
              </TextField>
            )}
          />

          {/* 수업 일정 섹션 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <p>수업 일정</p>
                <Tooltip delay={100}>
                  <Tooltip.Trigger>
                    <HelpCircleIcon strokeWidth={1.5} className="size-4" />
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="bottom" className="p-4">
                    <Tooltip.Arrow />
                    횟수와 요일을 선택하면 자동으로 일정을 계산합니다.
                  </Tooltip.Content>
                </Tooltip>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsScheduleModalOpen(true)}
              >
                <CalendarPlusIcon className="size-4" />
                {scheduledLessons.length > 0 ? '일정 수정' : '일정 추가'}
              </Button>
            </div>

            {scheduledLessons.length > 0
              ? (
                  <Surface className="p-2 flex flex-col gap-1 rounded-xl" variant="secondary">
                    <input type="hidden" name="lessonDuration" value={scheduleSettings?.duration ?? ''} />
                    <input type="hidden" name="nextPaymentAt" value={scheduleSettings?.nextPaymentDate?.toString() ?? ''} />
                    {scheduledLessons.map((lesson, idx) => (
                      <DateField
                        key={`lesson-${lesson.toString()}`}
                        aria-label={`${idx + 1}번째 수업`}
                        className="tabular-nums"
                        name={`lesson[${idx}]`}
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
                )
              : (
                  <Surface className="p-4 rounded-xl text-center text-sm text-neutral-500" variant="secondary">
                    수업 일정을 추가해보세요
                  </Surface>
                )}
          </div>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" isDisabled={isPending} onClick={close}>닫기</Button>
        <Button variant="primary" isPending={isPending} type="submit" form={formId}>저장</Button>
      </Modal.Footer>

      <ScheduleMeetingsModal
        isOpen={isScheduleModalOpen}
        onOpenChange={setIsScheduleModalOpen}
        onConfirm={handleScheduleConfirm}
        settings={scheduleSettings}
      />
    </React.Fragment>
  );
}
