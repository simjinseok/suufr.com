'use client';
import type { ModalProps } from '@heroui/react';

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
import { fromDate, toCalendarDateTime } from '@internationalized/date';
import { Controller, useForm } from 'react-hook-form';
import { CalendarIcon } from 'lucide-react';
import { updateSession, removeSession } from '@/actions/session';
import { TSession } from '@/types/index';
import { useHourCycle } from '@/contexts/time-format';

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

  console.log(session);
  const [state, formAction, isPending] = React.useActionState(updateSession, {
    fields: {
      isDone: session?.isDone,
      sessionAt: session.sessionAt,
      duration: session?.duration,
      notes: session?.notes,
      feedback: session?.feedback?.notes,
    },
  });
  const { control } = useForm({
    values: {
      isDone: state.fields?.isDone,
      sessionAt: state.fields?.sessionAt,
      duration: state.fields?.duration,
      notes: state.fields?.notes,
      feedback: state.fields?.feedback,
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
          <input type="hidden" name="sessionId" value={session.id} />
          <Controller
            control={control}
            name="isDone"
            render={({ field: { name, value, onChange } }) => (
              <Checkbox className="inline-flex" name={name} isSelected={value} onChange={onChange} value="on">
                <Checkbox.Control>
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
              <DateField
                name={name}
                granularity="minute"
                value={toCalendarDateTime(fromDate(value, 'Asia/Seoul'))}
                onChange={(date) => {
                  if (date) {
                    onChange(date.toDate('Asia/Seoul'));
                  }
                }}
                hourCycle={hourCycle}
                hideTimeZone
                isRequired
              >
                <Label>날짜</Label>
                <DateInputGroup>
                  <DateInputGroup.Prefix>
                    <CalendarIcon className="size-4" />
                  </DateInputGroup.Prefix>
                  <DateInputGroup.Input>
                    {segment => <DateInputGroup.Segment segment={segment} />}
                  </DateInputGroup.Input>
                </DateInputGroup>
              </DateField>
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
          <Controller
            control={control}
            name="notes"
            render={({ field: { name, value, onChange } }) => (
              <TextField
                name={name}
                value={value}
                onChange={onChange}
              >
                <Label>메모</Label>
                <TextArea rows={5} className="resize-none" />
                <Description>수강생에게 노출되지 않는 수업 메모입니다</Description>
              </TextField>
            )}
          />

          <Controller
            control={control}
            name="isDone"
            render={({ field: { value } }) => (
              <React.Activity mode={value ? 'visible' : 'hidden'}>
                <Controller
                  control={control}
                  name="feedback"
                  render={({ field: { name, value, onChange } }) => (
                    <TextField name={name} value={value} onChange={onChange}>
                      <Label>피드백</Label>
                      <TextArea rows={5} className="resize-none" />
                      <Description>수강생에게 보여줄 피드백입니다</Description>
                    </TextField>
                  )}
                />
              </React.Activity>
            )}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <RemoveButton sessionId={session.id} onSuccess={close} />
        <div className="grow" />
        <Button variant="ghost" isDisabled={isPending} onClick={close}>닫기</Button>
        <Button type="submit" form={formId} variant="primary" isPending={isPending}>저장</Button>
      </Modal.Footer>
    </React.Fragment>
  );
}

interface RemoveButtonProps {
  sessionId: Props['session']['id'];
  onSuccess: () => void;
}
function RemoveButton({ sessionId, onSuccess }: RemoveButtonProps) {
  const [state, formAction, isPending] = React.useActionState(removeSession, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert(state.message);
      if (typeof onSuccess === 'function') onSuccess();
    }
  }, [state.success, state.timestamp, state.message, onSuccess]);

  return (
    <Modal>
      <Button variant="danger-soft">삭제</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            {({ close }) => (
              <React.Fragment>
                <Modal.Header>
                  <Modal.Heading>삭제 확인</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  해당 수업을 삭제합니다.
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" isDisabled={isPending} onClick={close}>취소</Button>
                  <Form action={formAction}>
                    <input type="hidden" name="sessionId" value={sessionId} />
                    <Button type="submit" variant="danger" isPending={isPending}>삭제</Button>
                  </Form>
                </Modal.Footer>
              </React.Fragment>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
