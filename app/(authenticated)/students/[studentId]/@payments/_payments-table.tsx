'use client';

import { Chip } from '@heroui/react';
import { format } from 'date-fns';
import { numberToHangulMixed } from 'es-hangul';

type Syllabus = {
  id: number;
  title: string;
  createdAt: Date;
  payment: {
    id: number;
    amount: number;
    paymentMethod: string;
    paidAt: Date;
    notes: string | null;
  } | null;
};

type Props = {
  syllabuses: Syllabus[];
};

const PAYMENT_METHODS: Record<string, string> = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  none: '미지정',
};

export default function PaymentsTable({ syllabuses }: Props) {
  if (syllabuses.length === 0) {
    return (
      <div className="py-12 text-center text-zinc-500">
        등록된 계획이 없습니다
      </div>
    );
  }

  const paidSyllabuses = syllabuses.filter((s) => s.payment !== null);
  const unpaidSyllabuses = syllabuses.filter((s) => s.payment === null);
  const totalAmount = paidSyllabuses.reduce(
    (sum, s) => sum + (s.payment?.amount ?? 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-zinc-500">총 결제액</span>
          <span className="text-xl font-bold text-zinc-900 dark:text-white">
            {numberToHangulMixed(totalAmount)}원
          </span>
        </div>
        <div className="mt-1 text-sm text-zinc-500">
          결제 {paidSyllabuses.length}건
          {unpaidSyllabuses.length > 0 && (
            <span className="text-warning-600 dark:text-warning-400">
              {' '}
              · 미결제 {unpaidSyllabuses.length}건
            </span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50">
            <tr>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
                결제일
              </th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
                계획
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
                금액
              </th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
                결제수단
              </th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
                메모
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {syllabuses.map((syllabus) => (
              <tr
                key={syllabus.id}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
              >
                <td className="py-3 px-4 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {syllabus.payment ? (
                    format(new Date(syllabus.payment.paidAt), 'yyyy-MM-dd')
                  ) : (
                    <Chip size="sm" color="warning" variant="flat">
                      결제필요
                    </Chip>
                  )}
                </td>

                <td className="py-3 px-4 text-sm text-zinc-900 dark:text-white">
                  {syllabus.title}
                </td>

                <td className="py-3 px-4 text-sm tabular-nums text-right font-semibold text-zinc-900 dark:text-white">
                  {syllabus.payment
                    ? `${numberToHangulMixed(syllabus.payment.amount)}원`
                    : '-'}
                </td>

                <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                  {syllabus.payment
                    ? PAYMENT_METHODS[syllabus.payment.paymentMethod] ||
                      syllabus.payment.paymentMethod
                    : '-'}
                </td>

                <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                  {syllabus.payment?.notes || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
