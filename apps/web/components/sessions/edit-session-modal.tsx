'use client';
import type { ModalProps } from '@heroui/react';
import type { TSession } from '@/types/index';
import type { SessionOutcome } from '@/utils/session-outcome';

import * as React from 'react';
import {
  Button,
  DateField,
  DatePicker,
  Description,
  Form,
  Label,
  ListBox,
  Modal,
  NumberField,
  Popover,
  Select,
  TextArea,
  TextField,
} from '@heroui/react';
import { Calendar } from '@/components/calendar';
import { fromDate, toCalendarDateTime } from '@internationalized/date';
import { Controller, useForm } from 'react-hook-form';
import { useHourCycle } from '@/contexts/time-format';
import { useTimeZone } from '@/contexts/timezone';

import { updateSession, removeSession } from '@/actions/session';
import { getSessionOutcome, OUTCOME_LABEL } from '@/utils/session-outcome';

const OUTCOMES: SessionOutcome[] = ['scheduled', 'done', 'absent'];

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
  const timeZone = useTimeZone();
  const formId = React.useId();
  const hourCycle = useHourCycle();
  const initialOutcome = getSessionOutcome(session);

  const [state, formAction, isPending] = React.useActionState(updateSession, {
    fields: {
      outcome: initialOutcome,
      sessionAt: session.sessionAt,
      duration: session?.duration,
      notes: session?.notes,
    },
  });
  const { control } = useForm({
    values: {
      outcome: state.fields?.outcome,
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
          {/* 상태를 안 건드린 저장이 다른 곳에서 바꾼 상태를 덮어쓰지 않도록, 연 시점의 상태를 같이 보낸다 */}
          <input type="hidden" name="initialOutcome" value={initialOutcome} />

          <div className="flex flex-col gap-3">
            <Controller
              control={control}
              name="outcome"
              render={({ field: { name, value, onChange } }) => (
                <Select
                  variant="secondary"
                  isRequired
                  name={name}
                  value={value}
                  onChange={onChange}
                >
                  <Label>상태</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  {value === 'absent' && (
                    <Description>수업한 것으로 처리돼 남은 수업에서 빠집니다.</Description>
                  )}
                  <Select.Popover>
                    <ListBox>
                      {OUTCOMES.map(outcome => (
                        <ListBox.Item key={outcome} id={outcome} textValue={OUTCOME_LABEL[outcome]}>
                          <Label>{OUTCOME_LABEL[outcome]}</Label>
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              )}
            />
            <Controller
              control={control}
              name="sessionAt"
              render={({ field: { name, value, onChange } }) => (
                <DatePicker
                  granularity="minute"
                  hourCycle={hourCycle}
                  name={name}
                  value={toCalendarDateTime(fromDate(new Date(value), timeZone))}
                  onChange={(v) => v && onChange(v.toDate(timeZone))}
                  hideTimeZone
                  isRequired
                >
                  <Label>날짜 및 시간</Label>
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
                  <DatePicker.Popover className="min-w-fit">
                    <Calendar />
                  </DatePicker.Popover>
                </DatePicker>
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
