'use client';
import { Description, ModalProps, toast } from '@heroui/react';
import { TInvoice } from '@/types/index';

import React from 'react';
import {
  Form,
  Input,
  Modal,
  NumberField,
  TextArea,
  Button,
  TextField,
  Label,
  FieldError,
} from '@heroui/react';
import { numberToHangulMixed } from 'es-hangul';

import { updateInvoice } from '@/actions/invoice';
import { Controller, useForm } from 'react-hook-form';

interface Props {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  invoice: TInvoice;
}
export default function EditInvoiceModal({ invoice, isOpen, onOpenChange }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content invoice={invoice} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  invoice: Props['invoice'];
  close: () => void;
}
function Content({ invoice, close }: ContentProps) {
  const formId = React.useId();

  // 횟수는 회차 수강권에서만 의미 (환불 정산 시 회차 축소용 — docs/schema-redesign.md §3)
  const hasTotalCount = invoice.totalCount != null;

  const [state, formAction, isPending] = React.useActionState(updateInvoice, {
    fields: {
      title: invoice?.title ?? '',
      price: invoice?.price ?? 0,
      totalCount: invoice?.totalCount ?? 0,
      notes: invoice?.notes ?? '',
    },
  });

  const { control } = useForm({
    values: {
      title: state.fields?.title || '',
      price: state.fields?.price ?? 0,
      totalCount: state.fields?.totalCount ?? 0,
      notes: state.fields?.notes || '',
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      toast.success('수강권 수정', {
        description: state.message,
        timeout: 3000,
      });
      close();
    }
  }, [state.timestamp, state.success, state.message]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>수강권 수정</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={formAction}
          validationErrors={state.fieldErrors}
        >
          <input type="hidden" name="invoiceUuid" value={invoice.uuid} />

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
            name="price"
            render={({ field: { name, value, onChange } }) => (
              <NumberField
                variant="secondary"
                name={name}
                value={value}
                minValue={0}
                onInput={(event) => {
                  onChange(Number(event.currentTarget.value.replaceAll(',', '')) || 0);
                }}
              >
                <Label>금액</Label>
                <NumberField.Group>
                  <NumberField.Input className="col-span-full text-right" />
                </NumberField.Group>
                <Description className="text-right">
                  {numberToHangulMixed(value)}
                  원
                </Description>
                <FieldError />
              </NumberField>
            )}
          />
          {hasTotalCount && (
            <Controller
              control={control}
              name="totalCount"
              render={({ field: { name, value, onChange } }) => (
                <NumberField
                  variant="secondary"
                  name={name}
                  value={value}
                  minValue={0}
                  onChange={onChange}
                >
                  <Label>수업 횟수</Label>
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input className="w-14 text-center" />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                  <Description>중도 종료·환불 시 실제 진행 회차로 줄이면 잔여 회차가 정리됩니다.</Description>
                  <FieldError />
                </NumberField>
              )}
            />
          )}

          <Controller
            control={control}
            name="notes"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange}>
                <Label>메모</Label>
                <TextArea variant="secondary" rows={5} className="resize-none" />
                <Description>수강권 메모는 수강생에게 보여지지 않습니다.</Description>
                <FieldError />
              </TextField>
            )}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
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
