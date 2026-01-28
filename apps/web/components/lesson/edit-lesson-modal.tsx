'use client';
import { Description, ModalProps, toast } from '@heroui/react';
import { TLesson } from '@/types/index';

import React from 'react';
import {
  Form,
  Input,
  Modal,
  TextArea,
  Button,
  TextField,
  Label,
  AlertDialog,
  DangerIcon,
  FieldError,
} from '@heroui/react';

import { updateLesson, removeLesson } from '@/actions/lesson';
import { Controller, useForm } from 'react-hook-form';

interface Props {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  lesson: TLesson;
}
export default function EditLessonModal({ lesson, isOpen, onOpenChange }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content lesson={lesson} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  lesson: Props['lesson'];
  close: () => void;
}
function Content({ lesson, close }: ContentProps) {
  const formId = React.useId();

  const [state, formAction, isPending] = React.useActionState(updateLesson, {
    fields: {
      title: lesson?.title,
      notes: lesson?.notes,
    },
  });

  const { control } = useForm({
    values: {
      title: state.fields?.title || '',
      notes: state.fields?.notes || '',
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      toast.success('수업 수정', {
        description: state.message,
        timeout: 3000,
      });
      close();
    }
  }, [state.timestamp, state.success, state.message]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>계획 수정</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={formAction}
          validationErrors={state.fieldErrors}
        >
          <input type="hidden" name="lessonUuid" value={lesson.uuid} />

          <Controller
            control={control}
            name="title"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange}>
                <Label>제목</Label>
                <Input variant="secondary" />
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
                <TextArea variant="secondary" rows={5} className="resize-none" />
                <Description>레슨 내용은 수강생에게 보여지지 않습니다.</Description>
                <FieldError />
              </TextField>
            )}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <DeleteButton uuid={lesson.uuid} close={close} />
        <div className="grow" />
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

interface DeleteButtonProps {
  uuid: string;
  close: ContentProps['close'];
}
function DeleteButton({ uuid, close }: DeleteButtonProps) {
  const formId = React.useId();
  const [state, formAction, isPending] = React.useActionState(removeLesson, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.message) {
      toast.success('수업 수정', {
        description: state.message,
        timeout: 3000,
      });
    }

    if (state.success) {
      close();
    }
  }, [state.success, state.timestamp, state.message]);

  return (
    <AlertDialog>
      <Button
        variant="danger-soft"
      >
        삭제
      </Button>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="w-60">
            <AlertDialog.Header>
              <AlertDialog.Icon>
                <DangerIcon />
              </AlertDialog.Icon>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <Form
                id={formId}
                action={formAction}
              >
                <input type="hidden" name="lessonUuid" value={uuid} />
                계획을 삭제합니다.
              </Form>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="secondary" slot="close" isDisabled={isPending}>닫기</Button>
              <Button
                type="submit"
                form={formId}
                variant="danger-soft"
                isPending={isPending}
              >
                삭제
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>

      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
