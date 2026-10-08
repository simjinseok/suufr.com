'use client';
import React from 'react';
import { Button, Form, Modal, type ModalProps } from '@heroui/react';
import type { ServerActionState } from '@/types/index';

type RemoveAction = (prevState: ServerActionState<null>, formData: FormData) => Promise<ServerActionState<null>>;

interface Props {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  heading: string;
  message: string;
  action: RemoveAction;
  fields: Record<string, string>; // hidden input 으로 넘길 값 (uuid 들)
}

/** ⋮/⋯ 메뉴의 "삭제"가 띄우는 확인 모달. modal.show 로 띄우는 제어형. */
export default function DeleteConfirmModal({ isOpen, onOpenChange, heading, message, action, fields }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => <Content heading={heading} message={message} action={action} fields={fields} close={close} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function Content({ heading, message, action, fields, close }: Omit<Props, 'isOpen' | 'onOpenChange'> & { close: () => void }) {
  const formId = React.useId();
  const [state, formAction, isPending] = React.useActionState(action, {});

  React.useEffect(() => {
    if (!state.timestamp) return;
    if (state.success) {
      alert(state.message);
      close();
    }
  }, [state.timestamp, state.success]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>{heading}</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <p className="text-sm text-zinc-600">{message}</p>
        <Form id={formId} action={formAction}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" isDisabled={isPending} onClick={close}>닫기</Button>
        <Button form={formId} variant="danger" type="submit" isPending={isPending}>삭제</Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
