import React from 'react';
import {
  Button,
  Form,
  Modal,
  Select,
  TextArea, TextField, Label, ListBox, DateField, DateInputGroup,
} from '@heroui/react';
import { parseDate } from '@internationalized/date';

import { createStudentStatusHistory } from '@/actions/student';
import { Controller, useForm } from 'react-hook-form';
import dayjs from 'dayjs';

export default function ChangeStatusModal({ isOpen, onOpenChange, student }) {
  const formId = React.useId();

  const { control } = useForm({
    values: {
      changedAt: dayjs().format('YYYY-MM-DD'),
      status: student.status,
      notes: '',
    },
  });
  const [state, formAction, isPending] = React.useActionState(createStudentStatusHistory, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert(state.message);
      onOpenChange?.(false);
    }
  }, [state.timestamp, state.success, state.message]);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => (
            <React.Fragment>
              <Modal.Header>
                <Modal.Heading>수강생 상태 변경</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Form
                  className="p-1"
                  id={formId}
                  action={formAction}
                >
                  <input type="hidden" name="studentId" value={student.id} />
                  <Controller
                    control={control}
                    name="changedAt"
                    render={({ field: { name, value, onChange } }) => (
                      <DateField
                        name={name}
                        value={parseDate(value)}
                        onChange={(date) => {
                          if (!date) {
                            onChange('');
                            return;
                          }
                          onChange(date.toString());
                        }}
                      >
                        <Label>날짜</Label>
                        <DateInputGroup>
                          <DateInputGroup.Input>
                            {segment => <DateInputGroup.Segment segment={segment} />}
                          </DateInputGroup.Input>
                        </DateInputGroup>
                      </DateField>
                    )}
                  />
                  <Controller
                    control={control}
                    name="status"
                    render={({ field: { name, value, onChange } }) => (
                      <Select
                        className="mt-4"
                        name={name}
                        value={value}
                        onChange={onChange}
                        disabledKeys={[student.status]}
                        isDisabled={isPending}
                      >
                        <Label>상태</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox aria-label="상태 목록">
                            <ListBox.Item id="pending">대기중</ListBox.Item>
                            <ListBox.Item id="active">수강중</ListBox.Item>
                            <ListBox.Item id="paused">일시정지</ListBox.Item>
                            <ListBox.Item id="leave">그만둠</ListBox.Item>
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    )}
                  />
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { name, value, onChange } }) => (
                      <TextField className="mt-4" name={name} value={value} onChange={onChange}>
                        <Label>참고사항</Label>
                        <TextArea
                          rows={5}
                        />
                      </TextField>
                    )}
                  />
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" isDisabled={isPending} onPress={close}>
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
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
