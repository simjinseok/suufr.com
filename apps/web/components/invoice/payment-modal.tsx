'use client';
import type { ModalProps } from '@heroui/react';

import { numberToHangulMixed } from 'es-hangul';

import React from 'react';
import {
  Form,
  Modal,
  Button,
  DateField,
  DatePicker,
  Description,
  Input,
  NumberField,
  Tag,
  TagGroup,
  Select,
  ListBox,
  Label,
  TextField,
  toast,
} from '@heroui/react';
import { Calendar } from '@/components/calendar';
import { BanknoteIcon, BookDashedIcon, CreditCardIcon, LandmarkIcon } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';

import { updatePayment, removePayment } from '@/actions/payment';
import { invoiceOptionLabel, invoicePeriodLabel } from '@/utils/invoice-label';
import { fromDate, toCalendarDate, today } from '@internationalized/date';
import { useTimeZone } from '@/contexts/timezone';

// 학생 앞으로 입금을 기록/수정하는 모달. 금액의 진실 소스는 학생 단위 잔액(잔액 모델)이고,
// 수강권과는 선택적 연결만 한다 (§6-22 — 어느 수강권을 커버하는 입금인지 표시용).
// payment를 넘기면 그 입금을 수정, 없으면 새 입금을 생성한다.
type PaymentLike = {
  uuid: string;
  amount: number;
  method: string;
  paidAt: Date | string;
  notes: string | null;
  // 연결된 수강권 (수정 시 초기 선택값)
  invoices?: Array<{ uuid: string; title: string | null }>;
};

// 연결 선택지로 보여줄 수강권 — 모달이 뜰 때 /api/invoices 프록시로 불러온다
type InvoiceOption = {
  uuid: string;
  title: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  price: number;
};

interface Props {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  studentUuid: string;
  payment?: PaymentLike | null;
  // 새 입금의 기본 금액 (학생 미수액 제안)
  defaultAmount?: number;
  // 새 입금에서 미리 선택할 수강권 (수강권 카드의 미납 뱃지 진입점)
  defaultInvoiceUuid?: string;
}
export default function PaymentModal({ isOpen, onOpenChange, studentUuid, payment, defaultAmount, defaultInvoiceUuid }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content
              studentUuid={studentUuid}
              payment={payment ?? null}
              defaultAmount={defaultAmount}
              defaultInvoiceUuid={defaultInvoiceUuid}
              close={close}
            />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  studentUuid: string;
  payment: PaymentLike | null;
  defaultAmount?: number;
  defaultInvoiceUuid?: string;
  close: () => void;
}
function Content({ close, studentUuid, payment, defaultAmount, defaultInvoiceUuid }: ContentProps) {
  const timeZone = useTimeZone();
  const formId = React.useId();

  // 환불 = 음수 입금 (docs/schema-redesign.md §3). UI는 입금/환불 토글 + 양수 금액으로 받는다
  const [isRefund, setIsRefund] = React.useState((payment?.amount ?? 0) < 0);

  // 연결된 수강권 (§6-22) — 단일 선택. UI는 입금 1건 = 수강권 1개만 연결한다 (모델은 M:N 유지)
  const [linkedInvoiceUuid, setLinkedInvoiceUuid] = React.useState<string>(
    payment
      ? payment.invoices?.[0]?.uuid ?? ''
      : defaultInvoiceUuid ?? '',
  );

  // 선택지는 모달이 뜬 뒤 불러온다 — 부모가 목록을 미리 들고 있을 필요가 없다
  const [invoiceOptions, setInvoiceOptions] = React.useState<InvoiceOption[] | null>(null);
  React.useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch(`/api/invoices?studentUuid=${encodeURIComponent(studentUuid)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('failed');

        const json = await response.json();
        setInvoiceOptions(json.data);
      }
      catch (error) {
        if ((error as Error).name !== 'AbortError') setInvoiceOptions([]);
      }
    };

    load();
    return () => controller.abort();
  }, [studentUuid]);

  const { control, watch } = useForm({
    values: {
      paidAt: payment ? toCalendarDate(fromDate(new Date(payment.paidAt), timeZone)) : today(timeZone),
      amount: Math.abs(payment?.amount ?? defaultAmount ?? 0),
      method: payment?.method || 'transfer',
      notes: payment?.notes || '',
    },
  });

  const absAmount = Math.abs(watch('amount') || 0);
  const signedAmount = isRefund ? -absAmount : absAmount;

  const [state, formAction, isPending] = React.useActionState(updatePayment, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      toast.success('입금 내역', {
        description: state.message,
        timeout: 3000,
      });
      close();
    }
  }, [state.success, state.timestamp, state.message]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>{payment ? '입금내역 수정' : '입금 기록'}</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={formAction}
          validationErrors={state.fieldErrors}
        >
          <input type="hidden" name="studentUuid" value={studentUuid} />
          {payment?.uuid && <input type="hidden" name="paymentUuid" value={payment.uuid} />}
          {/* 서버로는 부호 적용된 금액 전송 (환불 = 음수) */}
          <input type="hidden" name="amount" value={signedAmount} />
          {/* 연결 마커 (§6-22) — 이 폼은 항상 연결 상태를 보내고, 빈 값 = 연결 없음 */}
          <input type="hidden" name="invoiceLinkScope" value="1" />
          {linkedInvoiceUuid && <input type="hidden" name="invoiceUuids" value={linkedInvoiceUuid} />}

          {/* 연결된 수강권 (§6-22) — 단일 선택 Select. 선택지는 모달 오픈 시 로드 */}
          {invoiceOptions !== null && invoiceOptions.length > 0 && (
            <Select
              variant="secondary"
              selectedKey={linkedInvoiceUuid}
              onSelectionChange={key => setLinkedInvoiceUuid((key as string) ?? '')}
            >
              <Label>연결된 수강권</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="" textValue="연결 안 함">
                    <Label>연결 안 함</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  {invoiceOptions.map(invoice => (
                    <ListBox.Item key={invoice.uuid} id={invoice.uuid} textValue={invoiceOptionLabel(invoice)}>
                      {/* 기간은 윗줄 작은 muted, 아랫줄 제목 · 금액 */}
                      <div className="flex-1 flex flex-col items-start gap-0.5 min-w-0">
                        {invoicePeriodLabel(invoice) && (
                          <span className="text-xs text-zinc-400">{invoicePeriodLabel(invoice)}</span>
                        )}
                        <span className="truncate">
                          {invoice.title || '수강권'}
                          {invoice.price > 0 && ` · ${numberToHangulMixed(invoice.price)}원`}
                        </span>
                      </div>
                      {/* 선택된 항목 오른쪽 체크 표시 */}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}

          {/* 입금 / 환불 구분 */}
          <TagGroup
            aria-label="구분"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([isRefund ? 'refund' : 'payment'])}
            onSelectionChange={(keys) => {
              const key = Array.from(keys as Set<string>)[0];
              setIsRefund(key === 'refund');
            }}
          >
            <Label>구분</Label>
            <TagGroup.List>
              <Tag id="payment" textValue="입금">입금</Tag>
              <Tag id="refund" textValue="환불">환불</Tag>
            </TagGroup.List>
          </TagGroup>

          <Controller
            control={control}
            name="paidAt"
            render={({ field: { name, value, onChange } }) => (
              <DatePickerField name={name} value={value} onChange={onChange} />
            )}
          />

          <Controller
            control={control}
            name="amount"
            render={({ field: { value, onChange } }) => (
              <React.Fragment>
                <NumberField
                  variant="secondary"
                  value={value}
                  minValue={0}
                  onInput={(event) => {
                    onChange(Math.abs(Number(event.currentTarget.value.replaceAll(',', '')) || 0));
                  }}
                >
                  <Label>{isRefund ? '환불 금액' : '금액'}</Label>
                  <NumberField.Group>
                    <NumberField.Input className="col-span-full text-right" />
                  </NumberField.Group>
                  <Description className="text-right">
                    {isRefund ? '환불 ' : ''}
                    {numberToHangulMixed(value)}
                    원
                  </Description>
                </NumberField>
              </React.Fragment>

            )}
          />

          <Controller
            control={control}
            name="method"
            render={({ field: { name, value, onChange } }) => (
              <Select
                variant="secondary"
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
                    <ListBox.Item id="none" textValue="미지정">
                      <BookDashedIcon />
                      <Label>
                        미지정
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
                <Input variant="secondary" />
              </TextField>
            )}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        {payment?.uuid && (
          <RemoveButton paymentUuid={payment.uuid} />
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

function DatePickerField({ name, value, onChange }: {
  name: string;
  value: ReturnType<typeof today>;
  onChange: (value: ReturnType<typeof today> | null) => void;
}) {
  return (
    <DatePicker name={name} value={value} onChange={onChange} granularity="day" hideTimeZone>
      <Label>날짜</Label>
      <DateField.Group variant="secondary">
        <DateField.Input>
          {segment => <DateField.Segment segment={segment} />}
        </DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DatePicker.Popover className="min-w-fit">
        <Calendar />
      </DatePicker.Popover>
    </DatePicker>
  );
}

function RemoveButton({ paymentUuid }: { paymentUuid: string }) {
  const formId = React.useId();
  const [state, formAction, isPending] = React.useActionState(removePayment, {
    success: false,
    timestamp: 0,
  });

  React.useEffect(() => {
    if (!state.timestamp) {
      return;
    }

    if (state.success) {
      toast.danger('입금 내역 삭제', {
        description: state.message,
        timeout: 3000,
      });
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
                    <input type="hidden" name="paymentUuid" value={paymentUuid} />
                    <p>입금 내역을 삭제합니다</p>
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
