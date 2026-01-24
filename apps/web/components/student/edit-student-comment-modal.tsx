'use client';
import { ModalProps, Popover } from '@heroui/react';

import * as React from 'react';
import { Button, Form, Label, Modal, Spinner, TextArea, TextField, toast } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';

import { removeStudentComment, updateStudentComment } from '@/actions/student-comment';

interface Props {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  comment: any;
}
export default function EditStudentCommentModal({ isOpen, onOpenChange, comment }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => (
            <Content comment={comment} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  comment: Props['comment'];
  close: () => void;
}
function Content({ comment, close }: ContentProps) {
  const formId = React.useId();

  const { control } = useForm({
    values: {
      content: comment?.content || '',
    },
  });
  const [state, formAction, isPending] = React.useActionState(updateStudentComment, {});

  React.useEffect(() => {
    if (!state.timestamp) {
      return;
    }

    if (state.success) {
      toast.success('수정', {
        description: '코멘트를 수정하였습니다',
        timeout: 2000,
      });
      close();
    }
  }, [state.success, state.timestamp]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>코멘트 수정</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form className="p-1" id={formId} action={formAction} validationErrors={state.fieldErrors}>
          <input type="hidden" name="commentUuid" value={comment.uuid} />
          <Controller
            control={control}
            name="content"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange}>
                <Label>내용</Label>
                <TextArea variant="secondary" rows={5} />
              </TextField>
            )}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <RemoveButton uuid={comment.uuid} close={close} />
        <div className="grow" />
        <Button variant="ghost" isDisabled={isPending} onPress={close}>
          닫기
        </Button>
        <Button
          form={formId}
          variant="primary"
          type="submit"
          isPending={isPending}
        >
          {({ isPending: pending }) => (
            <>
              {pending ? <Spinner color="current" size="sm" /> : null}
              저장
            </>
          )}
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
interface RemoveButtonProps {
  uuid: ContentProps['comment']['uuid'];
  close: ContentProps['close'];
}
function RemoveButton({ uuid, close }: RemoveButtonProps) {
  const [state, formAction, isPending] = React.useActionState(removeStudentComment, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      toast.danger('삭제', {
        description: state.message,
        timeout: 2000,
      });
      close();
    }
  }, [state.success, state.timestamp, state.message]);

  return (
    <Popover>
      <Button variant="danger-soft">삭제</Button>
      <Popover.Content placement="top left">
        <Popover.Arrow />
        <Popover.Dialog>
          <Popover.Heading>삭제 확인</Popover.Heading>
          <p className="mt-1 mb-3">이 코멘트를 삭제합니다.</p>
          <Form action={formAction}>
            <input type="hidden" name="commentUuid" value={uuid} />
            <Button type="submit" variant="danger" isPending={isPending}>삭제</Button>
          </Form>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
