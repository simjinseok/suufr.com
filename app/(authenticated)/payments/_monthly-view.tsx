'use client';
import React from 'react';
import { Card } from '@heroui/react';
import { numberToHangulMixed } from 'es-hangul';
import type { MonthlyPaymentStats } from '@/types/index';

type Props = {
  stats: MonthlyPaymentStats | null;
};

export default function MonthlyView({ stats }: Props) {
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

      {stats.students.length > 0 && (
        <Card className="border border-transparent dark:border-default-100">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-default-900 mb-4">
              수강생별 내역
            </h3>
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
                      수강생
                    </th>
                    <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
                      건수
                    </th>
                    <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
                      금액
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {stats.students.map(student => (
                    <tr
                      key={student.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-zinc-900 dark:text-white">
                        {student.name}
                      </td>
                      <td className="py-3 px-4 text-sm tabular-nums text-right text-zinc-700 dark:text-zinc-300">
                        {student.count}건
                      </td>
                      <td className="py-3 px-4 text-sm tabular-nums text-right font-medium text-zinc-900 dark:text-white">
                        {numberToHangulMixed(student.totalAmount)}원
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
