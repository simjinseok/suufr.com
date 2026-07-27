import type { PaymentView } from '@/types/index';

import { paymentsApi } from '@/utils/api/payments';

import React from 'react';

import ViewTabs from './_view-tabs';
import MonthlyView from './_monthly-view';
import YearlyView from './_yearly-view';
import NewPaymentButton from '@/components/payment/new-payment-button';
import {
  groupPaymentsByMonth,
  groupPaymentsByYear,
  getPrevMonth,
  getNextMonth, getPrevYear, getNextYear,
  formatMonthDate, formatYearDate,
} from '@/utils/payment-stats';
import { getUserSettings } from '@/utils/user-settings';
import { DEFAULT_TIMEZONE } from '@/utils/timezone';
import { TZDate } from '@date-fns/tz';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    view: string;
    date: string;
  }>;
};

function parseDateParam(date: string | undefined, timeZone: string): { year: number; month: number } {
  if (date) {
    const parts = date.split('-');
    if (parts.length >= 2) {
      return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) };
    }
    if (parts.length === 1) {
      return { year: parseInt(parts[0], 10), month: 1 };
    }
  }

  // date 파라미터가 없으면 유저 설정 타임존 기준 현재 연/월
  const now = new TZDate(new Date(), timeZone);
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default async function Page({ searchParams }: Props) {
  const { view: _view, date: _date } = await searchParams;

  const settings = await getUserSettings();
  const timeZone = settings.timezone ?? DEFAULT_TIMEZONE;

  const view: PaymentView = _view === 'yearly' ? 'yearly' : 'monthly';
  const { year, month } = parseDateParam(_date, timeZone);

  const [response, trendResponse] = await Promise.all([
    paymentsApi.list({
      year,
      month: view === 'monthly' ? month : undefined,
      limit: 1000,
    }),
    view === 'yearly' ? paymentsApi.getMonthlyTrend() : Promise.resolve(null),
  ]);

  const payments = response.data.map(p => ({
    id: p.id,
    uuid: p.uuid,
    amount: p.amount,
    method: p.method,
    notes: p.notes,
    paidAt: new Date(p.paidAt),
    student: {
      uuid: p.student.uuid,
      id: p.student.id,
      name: p.student.name,
    },
    // 수정 모달의 "연결된 수강권" 초기값 (§6-22)
    invoices: p.invoices,
  }));

  const monthlyStats = groupPaymentsByMonth(payments, timeZone);
  const yearlyStats = groupPaymentsByYear(payments, timeZone);

  const currentMonthStats = monthlyStats.length > 0 ? monthlyStats[0] : null;
  const currentYearStats = yearlyStats.length > 0 ? yearlyStats[0] : null;

  const buildNavUrl = (newDate: string) => {
    const params = new URLSearchParams();
    params.set('view', view);
    params.set('date', newDate);
    return `/payments?${params.toString()}`;
  };

  // 파라미터가 없어도 위에서 계산한 연/월을 명시해 런타임 로컬 타임존 폴백을 차단
  const currentDate = _date ?? (view === 'monthly' ? formatMonthDate(year, month) : formatYearDate(year));
  const prevDate = view === 'monthly' ? getPrevMonth(currentDate) : getPrevYear(currentDate);
  const nextDate = view === 'monthly' ? getNextMonth(currentDate) : getNextYear(currentDate);

  const displayDate = view === 'monthly'
    ? `${year}년 ${month}월`
    : `${year}년`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-default-900 lg:text-3xl">결제</h1>
        <div className="flex items-center gap-2">
          <ViewTabs view={view} />
          <NewPaymentButton />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Link
          href={buildNavUrl(prevDate)}
          className="flex items-center gap-1 text-default-600 hover:text-default-900 transition-colors"
        >
          <ChevronLeftIcon className="size-5" />
          <span>{view === 'monthly' ? '이전 월' : '이전 연도'}</span>
        </Link>

        <h2 className="text-xl font-bold text-default-900">
          {displayDate}
        </h2>

        <Link
          href={buildNavUrl(nextDate)}
          className="flex items-center gap-1 text-default-600 hover:text-default-900 transition-colors"
        >
          <span>{view === 'monthly' ? '다음 월' : '다음 연도'}</span>
          <ChevronRightIcon className="size-5" />
        </Link>
      </div>

      {view === 'monthly'
        ? (
            <MonthlyView stats={currentMonthStats} payments={payments} />
          )
        : (
            <YearlyView stats={currentYearStats} payments={payments} monthlyTrend={trendResponse?.data.months ?? []} />
          )}
    </div>
  );
}
