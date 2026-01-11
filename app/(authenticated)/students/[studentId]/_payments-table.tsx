'use client';

import { format } from 'date-fns';
import { numberToHangulMixed } from 'es-hangul';

type Payment = {
  id: number;
  amount: number;
  paymentMethod: string;
  paidAt: Date;
  notes: string | null;
  syllabus: {
    title: string;
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

export default function PaymentsTable({ payments }: Props) {
  if (payments.length === 0) {
    return (
      <div className="py-12 text-center text-zinc-500">
        입금 내역이 없습니다
      </div>
    );
  }

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

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
          총 {payments.length}건
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
            {payments.map((payment) => (
              <tr
                key={payment.id}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
              >
                <td className="py-3 px-4 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {format(new Date(payment.paidAt), 'yyyy-MM-dd')}
                </td>

                <td className="py-3 px-4 text-sm text-zinc-900 dark:text-white">
                  {payment.syllabus.title}
                </td>

                <td className="py-3 px-4 text-sm tabular-nums text-right font-semibold text-zinc-900 dark:text-white">
                  {numberToHangulMixed(payment.amount)}원
                </td>

                <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                  {PAYMENT_METHODS[payment.paymentMethod] || payment.paymentMethod}
                </td>

                <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                  {payment.notes || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
