'use client';
import type { ModalProps } from '@heroui/react';
import type { CalendarDate } from '@internationalized/date';

import React from 'react';

import {
  Button,
  DateField,
  DateInputGroup,
  FieldError,
  Form,
  Modal,
  Input,
  TextArea,
  Spinner,
  TextField,
  Label,
} from '@heroui/react';
import { CalendarIcon } from 'lucide-react';
import { fromDate, toCalendarDate } from '@internationalized/date';

import { updateStudent } from '@/actions/student';
import { useForm, Controller } from 'react-hook-form';
import { Student } from '@/types/index';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  student: Student;
}
export default function EditStudentModal({ isOpen, onOpenChange, student }: Props) {
  const formId = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);
  const allowResetRef = React.useRef<boolean>(false);

  const { control } = useForm<{
    id: number;
    name: string;
    notes: string;
    nextPaymentAt: CalendarDate | null;
  }>({
    values: {
      id: student.id,
      name: student.name,
      notes: student.notes,
      nextPaymentAt: student.nextPaymentAt
        ? toCalendarDate(fromDate(new Date(student.nextPaymentAt), 'Asia/Seoul'))
        : null,
    },
  });

  const [state, formAction, isPending] = React.useActionState(updateStudent, {});

  React.useEffect(() => {
    if (typeof state.success !== 'boolean') {
      return;
    }

    if (state.success) {
      alert('수강생 정보를 수정하였습니다');
      onOpenChange?.(false);
    }
  }, [state, onOpenChange]);

  React.useEffect(() => {
    const form = formRef.current;
    const preventReset = (e: Event) => {
      if (!allowResetRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
      allowResetRef.current = false; // 플래그 초기화
    };
    form?.addEventListener('reset', preventReset, true);
    return () => form?.removeEventListener('reset', preventReset, true);
  }, []);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => (
            <React.Fragment>
              <Modal.Header>
                <Modal.Heading>수강생 정보 변경</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Form
                  className="p-1"
                  ref={formRef}
                  id={formId}
                  action={formAction}
                  validationErrors={state?.errors}
                >
                  <input type="hidden" name="studentId" value={student.id} />
                  <Controller
                    control={control}
                    name="name"
                    render={({ field: { name, value, onChange } }) => (
                      <TextField
                        name={name}
                        value={value}
                        onChange={onChange}
                        isReadOnly={isPending}
                      >
                        <Label>이름</Label>
                        <Input />
                        <FieldError />
                      </TextField>
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
                  <Controller
                    control={control}
                    name="nextPaymentAt"
                    render={({ field: { name, value, onChange } }) => (
                      <DateField
                        className="mt-4"
                        name={name}
                        value={value}
                        onChange={onChange}
                        granularity="day"
                        hideTimeZone
                      >
                        <Label>다음결제예정일</Label>
                        <DateInputGroup>
                          <DateInputGroup.Input>
                            {segment => <DateInputGroup.Segment segment={segment} />}
                          </DateInputGroup.Input>
                          <DateInputGroup.Suffix>
                            <CalendarIcon className="size-4" />
                          </DateInputGroup.Suffix>
                        </DateInputGroup>
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
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
