'use client';

import * as React from 'react';
import { Avatar, Chip, Surface } from '@heroui/react';
import { UserIcon } from 'lucide-react';
import { numberToHangulMixed } from 'es-hangul';

import { formatInvoicePeriod, getCountProgress, getPeriodProgress } from '@/utils/invoice-period';
import type { InvoiceCardItem } from './_invoices-list';

type Props = {
  invoice: InvoiceCardItem;
  // 유저 타임존 기준 오늘 "YYYY-MM-DD" (서버 계산)
  today: string;
};

// 수강권 1개 = 카드 1장. 클릭 동작 없음 (2026-10-07 확정 시안).
export default function InvoiceCard({ invoice, today }: Props) {
  const period = formatInvoicePeriod(invoice.periodStart, invoice.periodEnd);

  return (
    <Surface className="rounded-xl shadow-xs p-4 flex flex-col gap-2.5 min-w-0">
      {/* 상단: 프로필 · 이름 · 제목 */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar size="md" className="shrink-0">
          {invoice.student.profileImageUrl
            ? <Avatar.Image src={invoice.student.profileImageUrl} alt={invoice.student.name} loading="lazy" />
            : null}
          <Avatar.Fallback><UserIcon className="size-4" /></Avatar.Fallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 leading-tight truncate">{invoice.student.name}</p>
          <p className="mt-0.5 text-sm text-gray-600 truncate">{invoice.title || '수강권'}</p>
        </div>
      </div>

      {/* 기간 줄 */}
      <p className="text-sm text-gray-500 tabular-nums">
        {period ?? <span className="text-gray-400">기간 없음</span>}
      </p>

      <UsageBlock invoice={invoice} today={today} />

      <SettlementFooter invoice={invoice} />
    </Surface>
  );
}

// 진행 블록: 회차권 → 완료/전체, 기간권 → 남은 일수, 둘 다 없으면 "횟수 제한 없음" + 빈 바
function UsageBlock({ invoice, today }: Props) {
  if (invoice.totalCount != null) {
    const { remaining, ratio } = getCountProgress(invoice.totalCount, invoice.doneCount);
    return (
      <ProgressRow
        left={remaining > 0 ? `${remaining}회 남음` : null}
        right={(
          <React.Fragment>
            <strong className="font-bold text-gray-900">{invoice.doneCount}</strong>
            {' / '}
            {invoice.totalCount}
            회
          </React.Fragment>
        )}
        ratio={ratio}
        isComplete={ratio >= 1}
      />
    );
  }

  const progress = getPeriodProgress(invoice.periodStart, invoice.periodEnd, today);
  if (progress) {
    const left = progress.daysLeft > 0
      ? `${progress.daysLeft}일 남음`
      : progress.daysLeft === 0 ? '오늘까지' : null;
    return <ProgressRow left={left} right="기간권" ratio={progress.ratio} isComplete={false} />;
  }

  // 사양: 흐린 글씨 (기간 줄의 "기간 없음"과 같은 농도)
  return (
    <ProgressRow
      left={<span className="text-gray-400">횟수 제한 없음</span>}
      right={null}
      ratio={0}
      isComplete={false}
    />
  );
}

function ProgressRow({ left, right, ratio, isComplete }: {
  left: React.ReactNode;
  right: React.ReactNode;
  ratio: number;
  isComplete: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm text-gray-600 tabular-nums">
        {/* 왼쪽 글자가 없어도 오른쪽은 제자리 (ml-auto) */}
        {left && <span>{left}</span>}
        {right != null && <span className="ml-auto">{right}</span>}
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${isComplete ? 'bg-success' : 'bg-accent'}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

// 정산 푸터: 왼쪽 납부 상태 칩(납부 완료 / 미납), 오른쪽 금액.
// 연결된 입금이 1건 이상이면 납부 완료 — 금액 검증은 하지 않는다(잔액모델이 진실 소스, §6-22).
// 0원 수강권은 납부 상태를 생략하고 금액만 (미납 노이즈 방지).
function SettlementFooter({ invoice }: { invoice: InvoiceCardItem }) {
  return (
    <div className="mt-0.5 pt-2.5 border-t border-dashed border-gray-200 flex items-center justify-between gap-3">
      {invoice.price > 0 && (
        invoice.payments.length > 0
          ? (
              <Chip size="sm" color="success" variant="soft" className="shrink-0">납부 완료</Chip>
            )
          : (
              <Chip size="sm" color="warning" variant="soft" className="shrink-0">미납</Chip>
            )
      )}
      <p className="ml-auto shrink-0 whitespace-nowrap text-base font-bold text-gray-900 tabular-nums">
        {numberToHangulMixed(invoice.price)}
        원
      </p>
    </div>
  );
}
