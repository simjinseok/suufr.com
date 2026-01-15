'use client';
import { numberToHangulMixed } from 'es-hangul';

import React from 'react';
import {
  Form,
  Modal,
  Button,
  DateField,
  NumberField,
  TextArea,
  Select, ListBox, Label, TextField, DateInputGroup,
} from '@heroui/react';
import { BanknoteIcon, BookDashedIcon, CalendarIcon, CreditCardIcon, LandmarkIcon } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';

import { updatePayment, removePayment } from '@/actions/payment';
import { fromDate, getLocalTimeZone, parseDate, toCalendarDate, today } from '@internationalized/date';

export default function PaymentModal({ isOpen, onClose, lesson }) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container placement="center">
        <Modal.Dialog>
          {({ close }) => (
            <Content
              lesson={lesson}
              close={close}
            />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function Content({ close, lesson }) {
  const formId = React.useId();

  const { control } = useForm({
    values: {
      paidAt: lesson?.payment ? toCalendarDate(fromDate(lesson.payment.paidAt, 'Asia/Seoul')) : today(getLocalTimeZone()),
      amount: lesson?.payment?.amount || 0,
      paymentMethod: lesson?.payment?.paymentMethod || 'card',
      notes: lesson?.payment?.notes || '',
    },
  });

  const [state, formAction, isPending] = React.useActionState(updatePayment, {});
  const payment = React.useMemo(() => {
    return lesson.payment;
  }, [lesson]);

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert(state.message);
      close();
    }
  }, [state.success, state.timestamp, state.message])

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>입금내역 수정</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={formAction}
          validationErrors={state.fieldErrors}
        >
          <input type="hidden" name="lessonId" value={lesson.id} />
          <Controller
            control={control}
            name="paidAt"
            render={({ field: { name, value, onChange } }) => (
              <DateField name={name} value={value} onChange={onChange} granularity="day" hideTimeZone>
                <Label>날짜</Label>
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

          <Controller
            control={control}
            name="amount"
            render={({ field: { name, value, onChange } }) => (
              <NumberField
                name={name}
                value={value}
                onInput={(event) => {
                  onChange(Number(event.currentTarget.value.replaceAll(',', '')));
                }}
              >
                <Label>금액</Label>
                <NumberField.Group>
                  <NumberField.Input className="text-right" />
                </NumberField.Group>
                <p className="text-right">
                  {numberToHangulMixed(value)}
                  원
                </p>
              </NumberField>
            )}
          />

          <Controller
            control={control}
            name="paymentMethod"
            render={({ field: { name, value, onChange } }) => (
              <Select
                name={name}
                value={value}
                onChange={onChange}
              >
                <Label>결제수단</Label>
                <Select.Trigger>
                  <Select.Value className="flex items-center gap-3" />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="card" textValue="카드">
                      <CreditCardIcon />
                      <Label>
                        카드
                      </Label>
                    </ListBox.Item>
                    <ListBox.Item id="transfer" textValue="transfer">
                      <LandmarkIcon />
                      <Label>
                        계좌이체
                      </Label>
                    </ListBox.Item>
                    <ListBox.Item id="cash" textValue="cash">
                      <BanknoteIcon />
                      <Label>
                        현금
                      </Label>
                    </ListBox.Item>
                    <ListBox.Item id="none" textValue="미결제">
                      <BookDashedIcon />
                      <Label>
                        미결제
                      </Label>
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            )}

          />

          <Controller
            control={control}
            name="notes"
            render={({ field: { name, value, onChange } }) => (
              <TextField
                name={name}
                value={value}
                onChange={onChange}
              >
                <Label>메모</Label>
                <TextArea rows={3} className="resize-none" />
              </TextField>
            )}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        {payment && (
          <RemoveButton lessonId={lesson.id} />
        )}
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

function RemoveButton({ lessonId }) {
  const formId = React.useId();
  const [state, formAction, isPending] = React.useActionState(removePayment, {});

  React.useEffect(() => {
    if (!state.timestamp) {
      return;
    }

    if (state.success) {
      alert('결제 내역을 삭제하였습니다');
    }
  }, [state.success, state.timestamp]);

  return (
    <Modal>
      <Button variant="danger-soft">
        삭제
      </Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            {({ close }) => (
              <React.Fragment>
                <Modal.Header>
                  <Modal.Heading>삭제 확인</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <Form id={formId} action={formAction}>
                    <input type="hidden" name="lessonId" value={lessonId} />
                    <p>결제내역을 삭제합니다</p>
                  </Form>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" isDisabled={isPending} onClick={close}>닫기</Button>
                  <Button type="submit" form={formId} isPending={isPending} variant="danger">삭제</Button>
                </Modal.Footer>
              </React.Fragment>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
