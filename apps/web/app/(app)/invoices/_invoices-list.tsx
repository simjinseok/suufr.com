'use client';

import * as React from 'react';

import { StudentFilter } from '@/components/student/student-filter';
import InvoiceCard from './_invoice-card';

export type InvoiceCardItem = {
  uuid: string;
  title: string | null;
  price: number;
  totalCount: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  // 완료(isDone) 세션 수 — 잔여 차감은 완료 기준이라 예정은 세지 않는다 (docs/schema-redesign.md §3)
  doneCount: number;
  student: {
    uuid: string;
    name: string;
    profileImageUrl: string | null;
  };
  // 연결된 미삭제 입금 (§6-22 순수 연결) — 1건 이상이면 입금 확인, 없으면 미납
  payments: Array<{ uuid: string; amount: number; paidAt: string }>;
};

type Props = {
  invoices: InvoiceCardItem[];
  selectedStudent: { uuid: string; name: string } | null;
  // 유저 타임존 기준 오늘 "YYYY-MM-DD" — 서버에서 한 번 계산해 hydration 이 항상 일치한다
  today: string;
};

// 수강권 1개 = 카드 1장 그리드. 카드 클릭·수업 펼치기 없음 (2026-10-07 확정 시안)
export default function InvoicesList({ invoices, selectedStudent, today }: Props) {
  return (
    <React.Fragment>
      <div className="mt-5 flex items-center justify-between gap-3">
        <StudentFilter selected={selectedStudent} />
      </div>

      {invoices.length === 0
        ? (
            <p className="mt-8 text-center text-gray-500">수강권이 없습니다.</p>
          )
        : (
            <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {invoices.map(invoice => (
                <li key={invoice.uuid} className="min-w-0">
                  <InvoiceCard invoice={invoice} today={today} />
                </li>
              ))}
            </ul>
          )}
    </React.Fragment>
  );
}
