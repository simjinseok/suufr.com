'use client';
import React from 'react';
import {
  Form,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  DatePicker,
  NumberInput,
  Textarea,
  Select,
  SelectItem,
} from '@heroui/react';
import { updatePayment } from '../../actions/update-payment';
import { BanknoteIcon, BookDashedIcon, CreditCardIcon, LandmarkIcon } from 'lucide-react';
import { fromDate, now } from '@internationalized/date';
import { removePayment } from '../../actions/remove-payment';

export default function PaymentModal({ isOpen, onClose, syllabus }) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        {onClose => (
          <Content
            syllabus={syllabus}
            onClose={onClose}
          />
        )}
      </ModalContent>
    </Modal>
  );
}

function Content({ onClose, syllabus }) {
  const formId = React.useId();

  const [isSubmitting, startSubmit] = React.useTransition();
  const [isDeleting, startDelete] = React.useTransition();
  const onSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startSubmit(async () => {
      await updatePayment((formData));
      onClose();
    });
  }, [syllabus]);

  const payment = React.useMemo(() => {
    return syllabus.payment;
  }, [syllabus]);

  return (
    <React.Fragment>
      <ModalHeader>입금내역 수정</ModalHeader>
      <ModalBody>
        <Form
          id={formId}
          onSubmit={onSubmit}
          className="gap-6"
        >
          <input type="hidden" name="syllabusId" value={syllabus.id} />
          <DatePicker
            hideTimeZone
            name="paidAt"
            granularity="day"
            label="날짜"
            defaultValue={payment ? fromDate(payment.paidAt, 'asia/seoul') : now('asia/seoul')}
          />

          <NumberInput
            hideStepper
            labelPlacement="outside"
            name="amount"
            defaultValue={payment ? payment.amount : 0}
            label="금액"
          />

          <Select
            label="결제수단"
            name="paymentMethod"
            defaultSelectedKeys={[payment ? payment.paymentMethod : 'none']}
          >
            <SelectItem
              key="card"
              startContent={<CreditCardIcon />}
            >
              카드
            </SelectItem>

            <SelectItem
              key="transfer"
              startContent={<LandmarkIcon />}
            >
              계좌이체
            </SelectItem>

            <SelectItem
              key="cash"
              startContent={<BanknoteIcon />}
            >
              현금
            </SelectItem>

            <SelectItem
              key="none"
              startContent={<BookDashedIcon />}
            >
              미결제
            </SelectItem>
          </Select>

          <Textarea
            label="메모"
            name="notes"
          />
        </Form>
      </ModalBody>
      <ModalFooter>
        {payment && (
          <Button
            color="danger"
            variant="light"
            isDisabled={isSubmitting}
            isLoading={isDeleting}
            onPress={() => {
              const formData = new FormData();
              formData.set('syllabusId', syllabus.id);
              startDelete(async () => {
                await removePayment(formData);
                onClose();
                alert('입금내역을 삭제하였습니다');
              });
            }}
          >
            삭제
          </Button>
        )}
        <div className="grow" />
        <Button variant="light" disabled={isDeleting || isSubmitting} onPress={onClose}>
          닫기
        </Button>
        <Button
          form={formId}
          color="primary"
          type="submit"
          isDisabled={isDeleting}
          isLoading={isSubmitting}
        >
          저장
        </Button>
      </ModalFooter>
    </React.Fragment>
  );
}
