'use client';
import React from 'react';
import {Button, Card, Tooltip} from '@heroui/react';
import { numberToHangulMixed } from 'es-hangul';
import { format } from 'date-fns/format';
import { MessageSquareTextIcon } from 'lucide-react';
import type { MonthlyPaymentStats } from '@/types/index';

type Payment = {
  id: number;
  amount: number;
  paymentMethod: string;
  notes: string | null;
  paidAt: Date;
  syllabus: {
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
      <div className="grid grid-cols-2 gap-4">
        <Card className="border border-transparent dark:border-default-100">
          <div className="p-4">
            <div className="flex flex-col gap-y-2">
              <dt className="text-small font-medium text-default-500">결제 건수</dt>
              <dd className="text-2xl font-semibold text-default-700">
                {stats.count}건
              </dd>
            </div>
          </div>
        </Card>

        <Card className="border border-transparent dark:border-default-100">
          <div className="p-4">
            <div className="flex flex-col gap-y-2">
              <dt className="text-small font-medium text-default-500">결제 금액</dt>
              <dd className="text-2xl font-semibold text-default-700">
                {numberToHangulMixed(stats.totalAmount)}원
              </dd>
            </div>
          </div>
        </Card>
      </div>

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
                        {payment.syllabus.student.name}
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
                          <Tooltip delay={0}>
                            <Button isIconOnly variant="tertiary">
                              <MessageSquareTextIcon className="size-4" />
                            </Button>
                            <Tooltip.Content>
                              <p className="whitespace-pre-wrap">{payment.notes}</p>
                            </Tooltip.Content>
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
