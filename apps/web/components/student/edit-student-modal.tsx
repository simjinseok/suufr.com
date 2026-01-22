'use client';
import type { ModalProps } from '@heroui/react';

import React from 'react';

import {
  Button,
  FieldError,
  Form,
  Modal,
  Input,
  TextArea,
  Spinner,
  TextField,
  Label,
} from '@heroui/react';

import { updateStudent } from '@/actions/student';
import { useForm, Controller } from 'react-hook-form';
import { Student } from '@/types/index';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  student: Student;
}
export default function EditStudentModal({ isOpen, onOpenChange, student }: Props) {
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
    id: number;
    name: string;
    notes: string;
    phone: string;
    email: string;
  }>({
    values: {
      id: student.id,
      name: student.name,
      notes: student.notes,
      phone: student.phone ?? '',
      email: student.email ?? '',
    },
  });

  const [state, formAction, isPending] = React.useActionState(updateStudent, {});

  React.useEffect(() => {
    if (!state.timestamp) {
      return;
    }

    if (state.success) {
      alert('수강생 정보를 수정하였습니다');
      close();
    }
  }, [state?.timestamp, state?.success, state?.message]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>수강생 정보 변경</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          className="p-1"
          id={formId}
          action={formAction}
          validationErrors={state?.fieldErrors}
        >
          <input type="hidden" name="studentUuid" value={student.uuid} />
          <div className="flex gap-3">
            <Controller
              control={control}
              name="name"
              render={({ field: { name, value, onChange } }) => (
                <TextField
                  className="w-2/5"
                  name={name}
                  value={value}
                  onChange={onChange}
                  isReadOnly={isPending}
                >
                  <Label>이름</Label>
                  <Input variant="secondary" autoComplete="off" />
                  <FieldError />
                </TextField>
              )}
            />
            <Controller
              control={control}
              name="phone"
              render={({ field: { name, value, onChange } }) => (
                <TextField
                  className="shrink w-3/5"
                  name={name}
                  value={value}
                  onChange={onChange}
                  isReadOnly={isPending}
                >
                  <Label>연락처</Label>
                  <Input variant="secondary" className="w-full" type="tel" autoComplete="off" placeholder="010-0000-0000" />
                  <FieldError />
                </TextField>
              )}
            />
          </div>
          <Controller
            control={control}
            name="email"
            render={({ field: { name, value, onChange } }) => (
              <TextField
                className="mt-4"
                name={name}
                value={value}
                onChange={onChange}
                isReadOnly={isPending}
              >
                <Label>이메일</Label>
                <Input variant="secondary" type="email" autoComplete="off" placeholder="example@example.com" />
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
                  variant="secondary"
                  placeholder="참고사항"
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
