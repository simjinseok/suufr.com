'use client';

import Link from 'next/link';
import { Chip, Surface } from '@heroui/react';
import { format } from 'date-fns/format';
import { ko } from 'date-fns/locale/ko';
import { tz } from '@date-fns/tz';
import { numberToHangulMixed } from 'es-hangul';

import PaymentModal from '@/components/invoice/payment-modal';
import { modal } from '@/contexts/modal-manager';
import { useTimeZone } from '@/contexts/timezone';

type Payment = {
  id: number;
  uuid: string;
  amount: number;
  method: string;
  paidAt: string;
  notes: string | null;
  student: {
    uuid: string;
    name: string;
  };
};

type Props = {
  payments: Payment[];
};

const PAYMENT_METHODS: Record<string, string> = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  none: '미지정',
};

export default function PaymentsList({ payments }: Props) {
  const timeZone = useTimeZone();

  if (payments.length === 0) {
    return <p className="mt-8 text-center text-gray-500">입금 내역이 없습니다.</p>;
  }

  return (
    <Surface className="mt-5 rounded-xl shadow-xs overflow-hidden">
      <ul>
        {payments.map((payment, index) => {
          const isRefund = payment.amount < 0;

          return (
            <li
              key={payment.uuid}
              className={`px-5 py-3 ${index > 0 ? 'border-t border-gray-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">
                      {format(new Date(payment.paidAt), 'yyyy년 M월 d일', { locale: ko, in: tz(timeZone) })}
                    </p>
                    <Link
                      href={`/students/${payment.student.uuid}`}
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      {payment.student.name}
                    </Link>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {PAYMENT_METHODS[payment.method] || payment.method}
                    {isRefund && (
                      <Chip size="sm" color="danger" variant="soft" className="ml-2">
                        환불
                      </Chip>
                    )}
                  </p>
                  {payment.notes && (
                    <p className="mt-1 text-sm text-gray-500 truncate">{payment.notes}</p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  <p className={`text-base font-bold tabular-nums ${isRefund ? 'text-danger-600' : 'text-gray-900'}`}>
                    {numberToHangulMixed(payment.amount)}
                    원
                  </p>
                  <Chip
                    size="sm"
                    variant="tertiary"
                    color="accent"
                    onClick={() => {
                      modal.show(PaymentModal, {
                        studentUuid: payment.student.uuid,
                        payment,
                      });
                    }}
                  >
                    수정
                  </Chip>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Surface>
  );
}
