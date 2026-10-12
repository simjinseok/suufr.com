'use client';

import * as React from 'react';
import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  ModalProps,
  NumberField,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import { numberToHangulMixed } from 'es-hangul';
import { today } from '@internationalized/date';

import { createInvoice } from '@/actions/invoice';
import { useTimeZone } from '@/contexts/timezone';
import { InvoicePeriodFields, type InvoicePeriod } from './invoice-period-fields';

interface Props {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  studentUuid: string;
}
export default function CreateInvoiceModal({ isOpen, onOpenChange, studentUuid }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content studentUuid={studentUuid} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  studentUuid: string;
  close: () => void;
}
function Content({ close, studentUuid }: ContentProps) {
  const timeZone = useTimeZone();
  const formId = React.useId();

  const [price, setPrice] = React.useState(0);
  // 시작일은 오늘, 종료일은 비움(무기한)으로 시작한다
  const [period, setPeriod] = React.useState<InvoicePeriod>(() => ({ start: today(timeZone), end: null }));
  const titleMonth = period.start.month;

  const [state, formAction, isPending] = React.useActionState(createInvoice, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      toast.success(state.message ?? '수강 등록했습니다', {
        timeout: 3000,
      });
      close();
    }
  }, [state.success, state.timestamp, state.message]);

  return (
    <>
      <Modal.Header>
        <Modal.Heading>수강 등록</Modal.Heading>
      </Modal.Header>

      <Modal.Body>
        <Form id={formId} className="p-1 flex flex-col gap-4" action={formAction} validationErrors={state.fieldErrors}>
          <input type="hidden" name="studentUuid" value={studentUuid} />
          <input type="hidden" name="price" value={price} />

          <TextField name="title">
            <Label>제목</Label>
            <Input
              variant="secondary"
              placeholder={`예: ${titleMonth}월분`}
            />
            <FieldError />
          </TextField>

          <NumberField
            variant="secondary"
            isRequired
            value={price}
            minValue={0}
            onInput={(event) => {
              setPrice(Number(event.currentTarget.value.replaceAll(',', '')) || 0);
            }}
          >
            <Label>금액</Label>
            <NumberField.Group>
              <NumberField.Input className="col-span-full text-right" />
            </NumberField.Group>
            <Description className="text-right">
              {numberToHangulMixed(price)}
              원
            </Description>
            <FieldError />
          </NumberField>

          <InvoicePeriodFields value={period} onChange={setPeriod} />

          <TextField name="notes">
            <Label>메모</Label>
            <TextArea variant="secondary" rows={5} className="resize-none" placeholder="메모" />
            <Description>수강생에게는 보여지지 않습니다.</Description>
            <FieldError />
          </TextField>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="ghost" isDisabled={isPending} onPress={close}>닫기</Button>
        <Button
          variant="primary"
          isPending={isPending}
          type="submit"
          form={formId}
        >
          저장
        </Button>
      </Modal.Footer>
    </>
  );
}
