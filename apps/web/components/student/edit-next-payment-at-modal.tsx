'use client';
import {Description, ModalProps} from '@heroui/react';
import type { CalendarDate } from '@internationalized/date';

import React from 'react';

import {
  Button,
  DateField,

  Form,
  Label,
  Modal,
  Spinner,
} from '@heroui/react';
import { CalendarIcon } from 'lucide-react';
import { parseDate } from '@internationalized/date';

import { updateStudentNextPaymentAt } from '@/actions/student';
import { useForm, Controller } from 'react-hook-form';
import { Student } from '@/types/index';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  student: Student;
}
export default function EditNextPaymentAtModal({ isOpen, onOpenChange, student }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => (
            <Content student={student} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  student: Props['student'];
  close: () => void;
}
function Content({ student, close }: ContentProps) {
  const formId = React.useId();

  const { control } = useForm<{
    nextPaymentAt: CalendarDate | null;
  }>({
    values: {
      // 달력 날짜(@db.Date, UTC 자정으로 직렬화) — 타임존 변환 없이 날짜 부분만 쓴다
      nextPaymentAt: student.nextPaymentAt
        ? parseDate(String(student.nextPaymentAt).slice(0, 10))
        : null,
    },
  });

  const [state, formAction, isPending] = React.useActionState(updateStudentNextPaymentAt, {});

  React.useEffect(() => {
    if (!state.timestamp) {
      return;
    }

    if (state.success) {
      alert('다음 결제 예정일을 변경하였습니다');
      close();
    }
  }, [state?.timestamp, state?.success, state?.message]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>다음 결제 예정일</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          className="p-1"
          id={formId}
          action={formAction}
          validationErrors={state?.fieldErrors}
        >
          <input type="hidden" name="studentUuid" value={student.uuid} />
          <Controller
            control={control}
            name="nextPaymentAt"
            render={({ field: { name, value, onChange } }) => (
              <DateField
                name={name}
                value={value}
                onChange={onChange}
                granularity="day"
                hideTimeZone
              >
                <Label>다음 결제 예정일</Label>
                <DateField.Group variant="secondary">
                  <DateField.Input>
                    {segment => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                  <DateField.Suffix>
                    <CalendarIcon className="size-4" />
                  </DateField.Suffix>
                </DateField.Group>
                <Description>수강생에게 다음 결제 예정일을 보여줍니다</Description>
              </DateField>
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
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              저장
            </>
          )}
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
