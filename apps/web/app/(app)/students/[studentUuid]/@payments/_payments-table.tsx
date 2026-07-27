'use client';

import { Button, Chip, Modal } from '@heroui/react';
import { format } from 'date-fns';
import { tz } from '@date-fns/tz';
import { numberToHangulMixed } from 'es-hangul';
import { ko } from 'date-fns/locale/ko';
import PaymentModal from '@/components/invoice/payment-modal';
import { modal } from '@/contexts/modal-manager';
import { useTimeZone } from '@/contexts/timezone';

type Payment = {
  id: number;
  uuid: string;
  amount: number;
  method: string;
  paidAt: Date;
  notes: string | null;
  // 연결된 수강권 (§6-22) — 수정 모달의 초기 선택값
  invoices: Array<{ uuid: string; title: string | null }>;
};

type Props = {
  studentUuid: string;
  payments: Payment[];
  outstandingAmount: number;
};

const PAYMENT_METHODS: Record<string, string> = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  none: '미지정',
};

export default function PaymentsTable({ studentUuid, payments, outstandingAmount }: Props) {
  const timeZone = useTimeZone();

  return (
    <div className="space-y-4">
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
