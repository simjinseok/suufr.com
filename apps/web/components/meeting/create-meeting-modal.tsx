'use client';
import React from 'react';
import {
  Form,
  Input,
  Modal,
  TextArea,
  Button,
  TextField,
  Label,
  FieldError,
  DateField, DateInputGroup,
} from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { now, getLocalTimeZone } from '@internationalized/date';

import { createMeeting } from '@/actions/meeting';
import { useHourCycle } from '@/contexts/time-format';

export default function CreateMeetingModal() {
  return (
    <Modal.Backdrop>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  close: () => void;
}

function Content({ close }: ContentProps) {
  const formId = React.useId();
  const hourCycle = useHourCycle();

  const [state, formAction, isPending] = React.useActionState(createMeeting, {
    fields: {
      name: '',
      meetingAt: '',
      phone: '',
      notes: '',
    },
  });

  const { control } = useForm({
    values: {
      name: state.fields?.name || '',
      meetingAt: state.fields?.meetingAt || '',
      phone: state.fields?.phone || '',
      notes: state.fields?.notes || '',
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert('상담을 추가하였습니다.');
      close();
    }
  }, [state.timestamp, state.success]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>상담 추가</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={formAction}
          validationErrors={state.fieldErrors}
        >
          <Controller
            control={control}
            name="name"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange} isRequired>
                <Label>이름</Label>
                <Input variant="secondary" />
                <FieldError />
              </TextField>
            )}
          />
          <DateField
            name="meetingAt"
            granularity="minute"
            defaultValue={now(getLocalTimeZone())}
            hourCycle={hourCycle}
          >
            <Label>날짜</Label>
            <DateInputGroup variant="secondary">
              <DateInputGroup.Input>
                {segment => <DateInputGroup.Segment segment={segment} />}
              </DateInputGroup.Input>
            </DateInputGroup>
            <FieldError />
          </DateField>
          <Controller
            control={control}
            name="phone"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange}>
                <Label>연락처</Label>
                <Input variant="secondary" type="tel" />
                <FieldError />
              </TextField>
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange}>
                <Label>메모</Label>
                <TextArea variant="secondary" rows={3} className="resize-none" />
                <FieldError />
              </TextField>
            )}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" isDisabled={isPending} onClick={close}>
          닫기
        </Button>
        <Button
          form={formId}
          variant="primary"
          type="submit"
          isPending={isPending}
        >
          저장
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
