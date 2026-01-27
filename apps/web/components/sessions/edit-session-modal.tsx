'use client';
import { ModalProps, Popover, TimeField } from '@heroui/react';

import * as React from 'react';
import {
  Button,
  Checkbox,
  DateField,
  DateInputGroup,
  Description,
  Form,
  Label,
  Modal,
  NumberField,
  TextArea,
  TextField,
} from '@heroui/react';
import { fromDate, toCalendarDate, toCalendarDateTime } from '@internationalized/date';
import { Controller, useForm } from 'react-hook-form';
import { CalendarIcon } from 'lucide-react';
import { updateSession, removeSession } from '@/actions/session';
import { TSession } from '@/types/index';
import { useHourCycle } from '@/contexts/time-format';
import { Calendar } from '@/components/calendar';
import MediaFilePicker, { MediaFilePickerState } from '@/components/media/media-file-picker';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  session: TSession;
}
export default function EditSessionModal({ isOpen, onOpenChange, session }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content session={session} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  session: Props['session'];
  close: () => void;
}
function Content({ session, close }: ContentProps) {
  const formId = React.useId();
  const hourCycle = useHourCycle();
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  // 세션 미디어 파일 상태
  const [mediaFiles, setMediaFiles] = React.useState<MediaFilePickerState>({
    existingFiles: session.sessionMediaFiles || [],
    pendingDetach: [],
    pendingAddExisting: [],
  });

  const [state, formAction, isPending] = React.useActionState(updateSession, {
    fields: {
      isDone: session?.isDone,
      sessionAt: session.sessionAt,
      duration: session?.duration,
      notes: session?.notes,
    },
  });
  const { control } = useForm({
    values: {
      isDone: state.fields?.isDone,
      sessionAt: state.fields?.sessionAt,
      duration: state.fields?.duration,
      notes: state.fields?.notes,
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.message) {
      alert(state.message);
    }

    if (state.success) {
      close();
    }
  }, [state.success, state.message, state.timestamp]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>세션 수정</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={formAction}
          validationErrors={state.fieldErrors}
        >
          <input type="hidden" name="sessionUuid" value={session.uuid} />

          {/* 세션 미디어 파일 변경 데이터 */}
          {(mediaFiles.pendingAddExisting?.length ?? 0) > 0 && (
            <input
              type="hidden"
              name="addMediaFileUuids"
              value={JSON.stringify(mediaFiles.pendingAddExisting!.map((f) => f.uuid))}
            />
          )}
          {mediaFiles.pendingDetach.length > 0 && (
            <input
              type="hidden"
              name="removeMediaFileUuids"
              value={JSON.stringify(mediaFiles.pendingDetach)}
            />
          )}

          <div className="flex flex-col gap-3">
            <Controller
              control={control}
              name="isDone"
              render={({ field: { name, value, onChange } }) => (
                <Checkbox className="inline-flex" name={name} isSelected={value} onChange={onChange} value="on" variant="secondary">
                  <Checkbox.Control className="size-5">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Content>
                    <Label>완료여부</Label>
                  </Checkbox.Content>
                </Checkbox>
              )}
            />
            <Controller
              control={control}
              name="sessionAt"
              render={({ field: { name, value, onChange } }) => (
                <div className="flex gap-1">
                  <input
                    type="hidden"
                    name={name}
                    value={toCalendarDateTime(fromDate(new Date(value), 'Asia/Seoul')).toString()}
                  />
                  <DateField
                    granularity="day"
                    value={toCalendarDate(fromDate(new Date(value), 'Asia/Seoul'))}
                    onChange={(v) => {
                      if (!v) return;
                      const current = fromDate(new Date(value), 'Asia/Seoul');
                      const updated = current.set({ year: v.year, month: v.month, day: v.day });
                      onChange(updated.toDate());
                    }}
                    hourCycle={hourCycle}
                    hideTimeZone
                    isRequired
                  >
                    <Label>날짜</Label>
                    <div className="flex items-center gap-1">
                      <Popover isOpen={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <Button
                          className="rounded-field"
                          size="sm"
                          isIconOnly
                          variant="tertiary"
                        >
                          <CalendarIcon className="size-4" />
                        </Button>
                        <Popover.Content placement="bottom left">
                          <Popover.Dialog>
                            <Calendar
                              value={toCalendarDate(fromDate(new Date(value), 'Asia/Seoul'))}
                              onChange={(newDate) => {
                                if (newDate) {
                                  const current = fromDate(new Date(value), 'Asia/Seoul');
                                  const updated = current.set({ year: newDate.year, month: newDate.month, day: newDate.day });
                                  onChange(updated.toDate());
                                  setIsCalendarOpen(false);
                                }
                              }}
                            />
                          </Popover.Dialog>
                        </Popover.Content>
                      </Popover>
                      <DateInputGroup variant="secondary">
                        <DateInputGroup.Input>
                          {segment => <DateInputGroup.Segment segment={segment} />}
                        </DateInputGroup.Input>
                      </DateInputGroup>
                    </div>
                  </DateField>
                  <TimeField
                    hourCycle={hourCycle}
                    granularity="minute"
                    value={toCalendarDateTime(fromDate(new Date(value), 'Asia/Seoul'))}
                    onChange={(v) => v && onChange(v.toDate('Asia/Seoul'))}
                    hideTimeZone
                  >
                    <Label>시간</Label>
                    <DateInputGroup variant="secondary">
                      <DateInputGroup.Input>
                        {segment => <DateInputGroup.Segment segment={segment} />}
                      </DateInputGroup.Input>
                    </DateInputGroup>
                  </TimeField>
                </div>
              )}
            />
            <Controller
              control={control}
              name="duration"
              render={({ field: { name, value, onChange } }) => (
                <NumberField
                  name={name}
                  value={value}
                  onChange={onChange}
                  minValue={5}
                  step={5}
                  variant="secondary"
                  aria-label="수업 시간 (분)"
                >
                  <Label>수업 시간 (분)</Label>
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                </NumberField>
              )}
            />
          </div>

          <div className="flex flex-col gap-4">
            <Controller
              control={control}
              name="notes"
              render={({ field: { name, value, onChange } }) => (
                <TextField
                  name={name}
                  value={value}
                  onChange={onChange}
                >
                  <Label>수업내용</Label>
                  <TextArea variant="secondary" rows={5} className="resize-none" />
                </TextField>
              )}
            />
            <MediaFilePicker
              variant="simple"
              value={mediaFiles}
              onChange={setMediaFiles}
              maxFiles={5}
            />
          </div>

        </Form>
      </Modal.Body>
      <Modal.Footer>
        <RemoveButton sessionUuid={session.uuid} onSuccess={close} />
        <div className="grow" />
        <Button variant="ghost" isDisabled={isPending} onClick={close}>닫기</Button>
        <Button type="submit" form={formId} variant="primary" isPending={isPending}>저장</Button>
      </Modal.Footer>
    </React.Fragment>
  );
}

interface RemoveButtonProps {
  sessionUuid: Props['session']['uuid'];
  onSuccess: () => void;
}
function RemoveButton({ sessionUuid, onSuccess }: RemoveButtonProps) {
  const [state, formAction, isPending] = React.useActionState(removeSession, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert(state.message);
      if (typeof onSuccess === 'function') onSuccess();
    }
  }, [state.success, state.timestamp, state.message, onSuccess]);

  return (
    <Popover>
      <Button variant="danger-soft">삭제</Button>
      <Popover.Content placement="top left">
        <Popover.Arrow />
        <Popover.Dialog>
          <Popover.Heading>삭제 확인</Popover.Heading>
          <p className="mt-1 mb-3">해당 수업을 삭제합니다.</p>
          <Form action={formAction}>
            <input type="hidden" name="sessionUuid" value={sessionUuid} />
            <Button type="submit" variant="danger" isPending={isPending}>삭제</Button>
          </Form>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
