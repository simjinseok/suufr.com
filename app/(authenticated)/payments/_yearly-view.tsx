'use client';
import React from 'react';
import { Card, Tooltip } from '@heroui/react';
import { numberToHangulMixed } from 'es-hangul';
import { format } from 'date-fns/format';
import { MessageSquareTextIcon } from 'lucide-react';
import type { YearlyPaymentStats } from '@/types/index';

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
  stats: YearlyPaymentStats | null;
  payments: Payment[];
};

export default function YearlyView({ stats, payments }: Props) {
  if (!stats || stats.count === 0) {
    return (
      <div className="mt-6 text-center py-12 text-default-500">
        해당 연도에 입금 내역이 없습니다.
      </div>
    );
  }

  const maxMonthAmount = Math.max(...stats.months.map(m => m.totalAmount), 1);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border border-transparent dark:border-default-100">
          <div className="p-4">
            <div className="flex flex-col gap-y-2">
              <dt className="text-small font-medium text-default-500">결제 건수</dt>
              <dd className="text-xl font-semibold text-default-700 sm:text-2xl">
                {stats.count}건
              </dd>
            </div>
          </div>
        </Card>

        <Card className="border border-transparent dark:border-default-100">
          <div className="p-4">
            <div className="flex flex-col gap-y-2">
              <dt className="text-small font-medium text-default-500">결제 금액</dt>
              <dd className="text-xl font-semibold text-default-700 sm:text-2xl">
                {numberToHangulMixed(stats.totalAmount)}원
              </dd>
            </div>
          </div>
        </Card>
      </div>

      {stats.months.length > 0 && (
        <Card className="border border-transparent dark:border-default-100">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-default-900 mb-4">
              월별 분포
            </h3>
            <div className="space-y-3">
              {stats.months
                .sort((a, b) => a.month - b.month)
                .map(month => (
                  <div key={`${month.year}-${month.month}`}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-default-700 font-medium">
                        {month.month}월
                      </span>
                      <span className="text-default-500 tabular-nums">
                        {month.count}건 · {numberToHangulMixed(month.totalAmount)}원
                      </span>
                    </div>
                    <div className="w-full bg-default-100 rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all"
                        style={{
                          width: `${(month.totalAmount / maxMonthAmount) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </Card>
      )}

      {payments.length > 0 && (
        <Card className="border border-transparent dark:border-default-100">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-default-900 mb-4">
              입금 내역
            </h3>
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
                      일자
                    </th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
                      수강생
                    </th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
                      결제수단
                    </th>
                    <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
                      금액
                    </th>
                    <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4 w-12">
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {payments.map(payment => (
                    <tr
                      key={payment.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm tabular-nums text-zinc-900 dark:text-white">
                        {format(payment.paidAt, 'yyyy-MM-dd')}
                      </td>
                      <td className="py-3 px-4 text-sm text-zinc-900 dark:text-white">
                        {payment.lesson.student.name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {payment.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm tabular-nums text-right font-medium text-zinc-900 dark:text-white">
                        {numberToHangulMixed(payment.amount)}원
                      </td>
                      <td className="py-3 px-4 text-center">
                        {payment.notes?.trim() && (
                          <Tooltip content={payment.notes}>
                            <button className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                              <MessageSquareTextIcon className="size-4 text-zinc-500" />
                            </button>
                          </Tooltip>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
