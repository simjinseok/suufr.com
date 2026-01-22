'use client';
import React from 'react';
import { ModalProps } from '@heroui/react';
import { TMeeting } from '@/types/index';
import {
  Form,
  Input,
  Modal,
  TextArea,
  Button,
  TextField,
  Label,
  FieldError,
  DateField,
  DateInputGroup,
  Checkbox,
} from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { fromDate, getLocalTimeZone } from '@internationalized/date';

import { updateMeeting } from '@/actions/meeting';
import { useHourCycle } from '@/contexts/time-format';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  meeting: TMeeting;
}

export default function EditMeetingModal({ meeting, isOpen, onOpenChange }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content meeting={meeting} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  meeting: TMeeting;
  close: () => void;
}

function Content({ meeting, close }: ContentProps) {
  const formId = React.useId();
  const hourCycle = useHourCycle();

  const [state, formAction, isPending] = React.useActionState(updateMeeting, {
    fields: {
      name: meeting.name,
      meetingAt: '',
      phone: meeting.phone || '',
      notes: meeting.notes || '',
      isDone: meeting.isDone,
    },
  });

  const { control } = useForm({
    values: {
      name: state.fields?.name || '',
      phone: state.fields?.phone || '',
      notes: state.fields?.notes || '',
      isDone: state.fields?.isDone || false,
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert('상담을 수정하였습니다.');
      close();
    }
  }, [state.timestamp, state.success]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>상담 수정</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={formAction}
          validationErrors={state.fieldErrors}
        >
          <input type="hidden" name="meetingUuid" value={meeting.uuid} />
          <Controller
            control={control}
            name="name"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange} isRequired>
                <Label>이름</Label>
                <Input variant="secondary" autoComplete="off" />
                <FieldError />
              </TextField>
            )}
          />
          <DateField
            name="meetingAt"
            granularity="minute"
            hideTimeZone
            hourCycle={hourCycle}
            defaultValue={fromDate(new Date(meeting.meetingAt), getLocalTimeZone())}
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
                <Input variant="secondary" type="tel" autoComplete="off" />
                <FieldError />
              </TextField>
            )}
          />
          <Controller
            control={control}
            name="isDone"
            render={({ field: { name, value, onChange } }) => (
              <Checkbox name={name} isSelected={value} onChange={onChange} value="on">
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
