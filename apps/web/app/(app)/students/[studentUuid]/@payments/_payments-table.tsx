'use client';

import { Button, Chip, Modal, Surface } from '@heroui/react';
import { format } from 'date-fns';
import { tz } from '@date-fns/tz';
import { numberToHangulMixed } from 'es-hangul';
import { ko } from 'date-fns/locale/ko';
import PaymentModal from '@/components/invoice/payment-modal';
import { modal } from '@/contexts/modal-manager';
import { useTimeZone } from '@/contexts/timezone';

type Invoice = {
  id: number;
  uuid: string;
  title: string | null;
  price: number;
  periodStart: string | null;
  periodEnd: string | null;
};

type Payment = {
  id: number;
  uuid: string;
  amount: number;
  method: string;
  paidAt: Date;
  notes: string | null;
};

type Props = {
  studentUuid: string;
  invoices: Invoice[];
  payments: Payment[];
  outstandingAmount: number;
  creditAmount: number;
};

const PAYMENT_METHODS: Record<string, string> = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  none: '미지정',
};

export default function PaymentsTable({ studentUuid, invoices, payments, outstandingAmount, creditAmount }: Props) {
  const timeZone = useTimeZone();
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-4">
      <Surface variant="secondary" className="rounded-2xl p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-primary-600">총 입금액</span>
          <span className="text-lg md:text-xl font-bold text-primary-900 tabular-nums">
            {numberToHangulMixed(totalPaid)}
            원
          </span>
        </div>
        {outstandingAmount > 0 && (
          <p className="mt-1 text-xs text-warning-600 font-medium">
            미수
            {' '}
            {numberToHangulMixed(outstandingAmount)}
            원
          </p>
        )}
        {creditAmount > 0 && (
          <p className="mt-1 text-xs text-accent-600 font-medium">
            선납 잔액
            {' '}
            {numberToHangulMixed(creditAmount)}
            원
          </p>
        )}
      </Surface>

      {/* 수강권(청구) 내역 */}
      <div>
        <h3 className="px-1 mb-2 text-sm font-semibold text-zinc-500">수강권</h3>
        {invoices.length === 0
          ? (
              <div className="py-8 text-center text-sm text-zinc-400 bg-white rounded-2xl">
                등록된 수강권이 없습니다
              </div>
            )
          : (
              <div className="bg-white rounded-2xl overflow-hidden">
                {invoices.map((invoice, index) => (
                  <div
                    key={invoice.id}
                    className={`
                    p-4 flex justify-between items-center gap-3
                    ${index !== invoices.length - 1 ? 'border-b border-zinc-100' : ''}
                  `}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-zinc-900">
                        {invoice.title || '수강권'}
                      </p>
                      {invoice.periodStart && (
                        // 달력 날짜(@db.Date) — 타임존 변환 없이 UTC 고정으로 표기
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {format(new Date(invoice.periodStart), 'M월 d일', { locale: ko, in: tz('UTC') })}
                          {invoice.periodEnd && (
                            <span>
                              {' ~ '}
                              {format(new Date(invoice.periodEnd), 'M월 d일', { locale: ko, in: tz('UTC') })}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {invoice.price === 0
                        ? (
                            <Chip size="sm" color="warning" variant="soft">
                              금액 미입력
                            </Chip>
                          )
                        : (
                            <p className="text-base font-bold text-zinc-900 tabular-nums">
                              {numberToHangulMixed(invoice.price)}
                              원
                            </p>
                          )}
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>

      {/* 입금 내역 */}
      <div>
        <div className="px-1 mb-2 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-zinc-500">입금</h3>
          <Modal>
            <Button size="sm" variant="primary">
              입금 기록
            </Button>
            <PaymentModal studentUuid={studentUuid} defaultAmount={outstandingAmount} />
          </Modal>
        </div>
        {payments.length === 0
          ? (
              <div className="py-8 text-center text-sm text-zinc-400 bg-white rounded-2xl">
                입금 내역이 없습니다
              </div>
            )
          : (
              <div className="bg-white rounded-2xl overflow-hidden">
                {payments.map((payment, index) => {
                  const isRefund = payment.amount < 0;
                  return (
                    <div
                      key={payment.id}
                      className={`
                      p-4
                      ${index !== payments.length - 1 ? 'border-b border-zinc-100' : ''}
                    `}
                    >
                      <div className="flex justify-between items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-600">
                            {format(payment.paidAt, 'yyyy년 M월 d일', { locale: ko, in: tz(timeZone) })}
                            &nbsp;·&nbsp;
                            {PAYMENT_METHODS[payment.method] || payment.method}
                            {isRefund && (
                              <Chip size="sm" color="danger" variant="soft" className="ml-2">
                                환불
                              </Chip>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-3">
                          <p className={`text-base font-bold tabular-nums ${isRefund ? 'text-danger-600' : 'text-zinc-900'}`}>
                            {numberToHangulMixed(payment.amount)}
                            원
                          </p>
                          <Chip
                            size="sm"
                            variant="tertiary"
                            color="accent"
                            onClick={() => {
                              modal.show(PaymentModal, { studentUuid, payment });
                            }}
                          >
                            수정
                          </Chip>
                        </div>
                      </div>

                      {payment.notes && (
                        <div className="mt-3 p-3 rounded-lg text-sm text-zinc-600 leading-relaxed whitespace-pre-line bg-zinc-50">
                          {payment.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
      </div>
    </div>
  );
}
