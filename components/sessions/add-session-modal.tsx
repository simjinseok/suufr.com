'use client';
import * as React from 'react';
import {
  Button,
  DateField,
  DateInputGroup,
  Form,
  Label,
  Modal,
  NumberField,
  TextArea,
  TextField,
} from '@heroui/react';
import { toCalendarDateTime, today } from '@internationalized/date';
import { Controller, useForm } from 'react-hook-form';
import { CalendarIcon } from 'lucide-react';
import { createSession } from '@/actions/session';
import { useHourCycle, useDefaultDuration } from '@/contexts/time-format';

export default function AddSessionModal({ isOpen, onOpenChange, lesson }) {
  const formId = React.useId();
  const hourCycle = useHourCycle();
  const defaultDuration = useDefaultDuration();
  const { control } = useForm({
    values: {
      sessionAt: toCalendarDateTime(today('Asia/Seoul')),
      duration: defaultDuration,
      notes: '',
    },
  });

  const [state, formAction, isPending] = React.useActionState(createSession, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.message) {
      alert(state.message);
    }

    if (state.success) {
      onOpenChange(false);
    }
  }, [state.success, state.message, state.timestamp]);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <React.Fragment>
              <Modal.Header>
                <Modal.Heading>수업 추가</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Form id={formId} className="p-1 flex flex-col gap-4" action={formAction}>
                  <input type="hidden" name="lessonId" value={lesson.id} />
                  <Controller
                    control={control}
                    name="sessionAt"
                    render={({ field: { name, value, onChange } }) => (
                      <DateField
                        name={name}
                        granularity="minute"
                        value={value}
                        onChange={onChange}
                        hourCycle={hourCycle}
                        hideTimeZone
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
                          <NumberField.Input className="w-16 text-center" />
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
                      </TextField>
                    )}
                  />
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" isDisabled={isPending} onClick={close}>닫기</Button>
                <Button type="submit" form={formId} variant="primary" isPending={isPending}>저장</Button>
              </Modal.Footer>
            </React.Fragment>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
