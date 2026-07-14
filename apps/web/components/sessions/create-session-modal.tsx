'use client';
import * as React from 'react';
import {
  Button,
  DateField,
  DatePicker,
  Form,
  Label,
  Modal,
  NumberField,
  TextArea,
  TextField,
} from '@heroui/react';
import { Calendar } from '@/components/calendar';
import { toCalendarDateTime, today } from '@internationalized/date';
import { Controller, useForm } from 'react-hook-form';
import { createSession } from '@/actions/session';
import { useHourCycle, useDefaultDuration } from '@/contexts/time-format';
import { useTimeZone } from '@/contexts/timezone';

interface Props {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  studentUuid: string;
  invoiceUuid?: string;
}

export default function CreateSessionModal({ isOpen, onOpenChange, studentUuid, invoiceUuid }: Props) {
  const timeZone = useTimeZone();
  const formId = React.useId();
  const hourCycle = useHourCycle();
  const defaultDuration = useDefaultDuration();
  const { control } = useForm({
    values: {
      sessionAt: toCalendarDateTime(today(timeZone)),
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
                  <input type="hidden" name="studentUuid" value={studentUuid} />
                  {invoiceUuid && <input type="hidden" name="invoiceUuid" value={invoiceUuid} />}
                  <Controller
                    control={control}
                    name="sessionAt"
                    render={({ field: { name, value, onChange } }) => (
                      <DatePicker
                        name={name}
                        granularity="minute"
                        hourCycle={hourCycle}
                        value={value}
                        onChange={(v) => v && onChange(v)}
                        hideTimeZone
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
                        variant="secondary"
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
                        <TextArea variant="secondary" rows={5} className="resize-none" />
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
