'use client';

import React from 'react';
import { AlertDialog, Button, DangerIcon, Form, ModalProps, toast } from '@heroui/react';
import { TInvoice } from '@/types/index';
import { removeInvoice } from '@/actions/invoice';

interface Props {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  invoice: TInvoice;
}

export default function DeleteInvoiceModal({ invoice, isOpen, onOpenChange }: Props) {
  const formId = React.useId();
  const [state, formAction, isPending] = React.useActionState(removeInvoice, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.message) {
      toast.success('수강권 삭제', {
        description: state.message,
        timeout: 3000,
      });
    }

    if (state.success) {
      onOpenChange?.(false);
    }
  }, [state.success, state.timestamp, state.message]);

  return (
    <AlertDialog>
      <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog className="w-60">
            <AlertDialog.Header>
              <AlertDialog.Icon>
                <DangerIcon />
              </AlertDialog.Icon>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <Form id={formId} action={formAction}>
                <input type="hidden" name="invoiceUuid" value={invoice.uuid} />
                수강권을 삭제합니다. 입금 내역도 함께 목록에서 사라집니다.
              </Form>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="tertiary" slot="close" isDisabled={isPending}>
                닫기
              </Button>
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
