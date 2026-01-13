'use client';
import { format } from 'date-fns/format';
import { numberToHangulMixed } from 'es-hangul';

import React from 'react';

import {
  Button,
} from '@heroui/react';
import PaymentModal from '@/components/lesson/payment-modal';

export default function Payments({ syllabuses }) {
  const [editingSyllabus, setEditingSyllabus] = React.useState(null);

  return (
    <React.Fragment>
      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <table className="w-full">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50">
            <tr>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-6">일자</th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-6">결제수단</th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-6">금액</th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-6">수강생</th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-6">메모</th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {syllabuses.map(syllabus => (
              <tr
                key={`syllabus-${syllabus.id}`}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
              >
                <td className="py-4 px-6 text-sm tabular-nums text-zinc-900 dark:text-white">
                  {format(syllabus.payment.paidAt, 'yyyy-MM-dd')}
                </td>
                <td className="py-4 px-6">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {syllabus.payment.paymentMethod}
                  </span>
                </td>
                <td className="py-4 px-6 text-sm tabular-nums text-right font-medium text-zinc-900 dark:text-white">
                  {numberToHangulMixed(syllabus.payment.amount)}
                  원
                </td>
                <td className="py-4 px-6 text-sm text-zinc-700 dark:text-zinc-300">
                  {syllabus.student.name}
                </td>
                <td className="py-4 px-6 text-sm text-zinc-500 dark:text-zinc-400 max-w-xs truncate">
                  {syllabus.payment.notes || '—'}
                </td>
                <td className="py-4 px-6 text-right">
                  <Button size="sm" variant="light" onPress={() => setEditingSyllabus(syllabus)}>
                    수정
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* <PaymentModal */}
      {/*  isOpen={editingSyllabus !== null} */}
      {/*  syllabus={editingSyllabus} */}
      {/*  onClose={() => { setEditingSyllabus(null); }} */}
      {/* /> */}
    </React.Fragment>
  );
}
