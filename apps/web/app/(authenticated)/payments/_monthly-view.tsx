'use client';
import React from 'react';
import { Button, Card } from '@heroui/react';
import { numberToHangulMixed } from 'es-hangul';
import { format } from 'date-fns/format';
import type { MonthlyPaymentStats } from '@/types/index';
import { ko } from 'date-fns/locale';

type Payment = {
  id: number;
  amount: number;
  paymentMethod: string;
  notes: string | null;
  paidAt: Date;
  lesson: {
    student: {
      id: number;
      name: string;
    };
  };
};

type Props = {
  stats: MonthlyPaymentStats | null;
  payments: Payment[];
};

export default function MonthlyView({ stats, payments }: Props) {
  if (!stats || stats.count === 0) {
    return (
      <div className="mt-6 text-center py-12 text-default-500">
        해당 월에 입금 내역이 없습니다.
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
        <ul className="flex flex-col gap-3">
          {payments.map(payment => (
            <li key={payment.id}>
              <Card>
                <div className="flex justify-between items-end">
                  <div className="flex flex-col justify-end">
                    <p className="text-xl font-bold">{payment.lesson.student.name}</p>
                    {payment.notes && (
                      <p className="line-clamp-1 text-sm text-gray-600">{payment.notes}</p>
                    )}
                    <p className="mt-2 text-sm font-medium text-gray-500">{format(payment.paidAt, 'yyyy-MM-dd', { locale: ko })}</p>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <div>
                      <Button size="sm" variant="ghost">수정</Button>
                    </div>
                    <div className="flex flex-col items-end">
                      <p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {payment.paymentMethod}
                        </span>
                      </p>
                      <p className="text-xl font-bold">
                        {numberToHangulMixed(payment.amount)}
                        원
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
