'use client';
import React from 'react';
import { Card, Chip } from '@heroui/react';
import { numberToHangulMixed } from 'es-hangul';
import { format } from 'date-fns/format';
import type { MonthlyPaymentStats } from '@/types/index';
import { ko } from 'date-fns/locale';
import { tz } from '@date-fns/tz';
import PaymentModal from '@/components/invoice/payment-modal';
import { modal } from '@/contexts/modal-manager';
import { useTimeZone } from '@/contexts/timezone';

type Payment = {
  id: number;
  uuid: string;
  amount: number;
  method: string;
  notes: string | null;
  paidAt: Date;
  student: {
    uuid: string;
    id: number;
    name: string;
  };
};

const PAYMENT_METHODS: Record<string, string> = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  none: '미지정',
};

type Props = {
  stats: MonthlyPaymentStats | null;
  payments: Payment[];
};

export default function MonthlyView({ stats, payments }: Props) {
  const timeZone = useTimeZone();

  if (!stats || stats.count === 0) {
    return (
      <div className="mt-6 text-center py-12 text-default-500">
        해당 월에 결제 내역이 없습니다.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border border-transparent dark:border-default-100">
          <div className="p-4">
            <div className="flex flex-col gap-y-2">
              <dt className="text-small font-medium text-default-500">결제 건수</dt>
              <dd className="text-xl font-semibold text-default-700 sm:text-2xl">
                {stats.count}
                건
              </dd>
            </div>
          </div>
        </Card>

        <Card className="border border-transparent dark:border-default-100">
          <div className="p-4">
            <div className="flex flex-col gap-y-2">
              <dt className="text-small font-medium text-default-500">결제 금액</dt>
              <dd className="text-xl font-semibold text-default-700 sm:text-2xl">
                {numberToHangulMixed(stats.totalAmount)}
                원
              </dd>
            </div>
          </div>
        </Card>
      </div>

      {payments.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden">
          {payments.map((payment, index) => (
            <div
              key={payment.id}
              className={`p-4 ${index !== payments.length - 1 ? 'border-b border-zinc-100' : ''}`}
            >
              <div className="flex justify-between items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-zinc-900">
                    {payment.student.name}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {format(payment.paidAt, 'M월 d일', { locale: ko, in: tz(timeZone) })}
                    &nbsp;·&nbsp;
                    {PAYMENT_METHODS[payment.method] || payment.method}
                  </p>
                </div>
                <div className="shrink-0">
                  <div className="flex flex-col items-end">
                    <Chip
                      size="sm"
                      variant="tertiary"
                      color="accent"
                      onClick={() => {
                        modal.show(PaymentModal, {
                          studentUuid: payment.student.uuid,
                          payment: {
                            uuid: payment.uuid,
                            amount: payment.amount,
                            method: payment.method,
                            paidAt: payment.paidAt,
                            notes: payment.notes,
                          },
                        });
                      }}
                    >
                      수정
                    </Chip>
                    <p className="text-base font-bold text-zinc-900 tabular-nums">
                      {numberToHangulMixed(payment.amount)}
                      원
                    </p>
                  </div>
                </div>
              </div>

              {payment.notes && (
                <div className="mt-3 p-3 rounded-lg text-sm text-zinc-600 leading-relaxed whitespace-pre-line bg-zinc-50">
                  {payment.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
