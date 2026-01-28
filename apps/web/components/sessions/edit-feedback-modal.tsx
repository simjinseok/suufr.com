'use client';
import { ModalProps, Popover } from '@heroui/react';
import * as React from 'react';
import {
  Button,
  Description,
  Form,
  Label,
  Modal,
  TextArea,
  TextField,
} from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { updateFeedback } from '@/actions/session';
import { TSession } from '@/types/index';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  session: TSession;
}

export default function EditFeedbackModal({ isOpen, onOpenChange, session }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content session={session} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  session: Props['session'];
  close: () => void;
}

function Content({ session, close }: ContentProps) {
  const formId = React.useId();

  const [state, formAction, isPending] = React.useActionState(updateFeedback, {
    success: false,
    timestamp: 0,
  });

  const { control } = useForm({
    values: {
      notes: session.feedback?.notes ?? '',
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.message) {
      alert(state.message);
    }

    if (state.success) {
      close();
    }
  }, [state.success, state.message, state.timestamp, close]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>피드백 수정</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={formAction}
          validationErrors={undefined}
        >
          <input type="hidden" name="sessionUuid" value={session.uuid} />

          <Controller
            control={control}
            name="notes"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value ?? ''} onChange={onChange}>
                <Label>피드백</Label>
                <TextArea variant="secondary" rows={5} className="resize-none" />
                <Description>수강생에게 보여줄 피드백입니다</Description>
              </TextField>
            )}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        {session.feedback && (
          <DeleteButton sessionUuid={session.uuid} onSuccess={close} />
        )}
        <div className="grow" />
        <Button variant="ghost" isDisabled={isPending} onClick={close}>닫기</Button>
        <Button type="submit" form={formId} variant="primary" isPending={isPending}>저장</Button>
      </Modal.Footer>
    </React.Fragment>
  );
}

interface DeleteButtonProps {
  sessionUuid: Props['session']['uuid'];
  onSuccess: () => void;
}

function DeleteButton({ sessionUuid, onSuccess }: DeleteButtonProps) {
  const [state, formAction, isPending] = React.useActionState(updateFeedback, {
    success: false,
    timestamp: 0,
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert(state.message);
      if (typeof onSuccess === 'function') onSuccess();
    }
  }, [state.success, state.timestamp, state.message, onSuccess]);

  return (
    <Popover>
      <Button variant="danger-soft">삭제</Button>
      <Popover.Content placement="top left">
        <Popover.Arrow />
        <Popover.Dialog>
          <Popover.Heading>삭제 확인</Popover.Heading>
          <p className="mt-1 mb-3">피드백을 삭제합니다.</p>
          <Form action={formAction}>
            <input type="hidden" name="sessionUuid" value={sessionUuid} />
            <input type="hidden" name="delete" value="true" />
            <Button type="submit" variant="danger" isPending={isPending}>삭제</Button>
          </Form>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
