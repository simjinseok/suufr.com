'use client';
import type { ModalProps } from '@heroui/react';

import React from 'react';

import {
  Button,
  FieldError,
  Form,
  Modal,
  Input,
  Select,
  TextArea,
  ListBox,
  Spinner,
  TextField,
  Label,
} from '@heroui/react';

import { createStudent } from '@/actions/create-student';
import { useForm, Controller } from 'react-hook-form';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
}
export default function StudentModal({ isOpen, onOpenChange }: Props) {
  const formId = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);
  const allowResetRef = React.useRef<boolean>(false);

  const { control } = useForm({
    values: {
      name: '',
      status: 'active',
      notes: '',
    },
  });

  const [state, formAction, isPending] = React.useActionState(createStudent, {
    fields: {
      name: '',
      status: 'active',
      notes: '',
    },
  });
  console.log('state', state);

  React.useEffect(() => {
    if (typeof state.success !== 'boolean') {
      return;
    }

    if (state.success) {
      alert('수강생을 추가하였습니다');
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
                <Modal.Heading>수강생 추가</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Form
                  className="px-1"
                  ref={formRef}
                  id={formId}
                  action={formAction}
                  validationErrors={state?.errors}
                >

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
                  <Select
                    className="mt-4"
                    name="status"
                    defaultValue={state.fields.status}
                    isDisabled={isPending}
                  >
                    <Label>상태</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="pending">
                          대기중
                        </ListBox.Item>
                        <ListBox.Item id="active">
                          수강중
                        </ListBox.Item>
                        <ListBox.Item id="paused">
                          일시정지
                        </ListBox.Item>
                        <ListBox.Item id="leave">
                          그만둠
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <TextField className="mt-4" name="notes" defaultValue={state.fields.notes}>
                    <Label>참고사항</Label>
                    <TextArea
                      rows={5}
                    />
                  </TextField>
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
