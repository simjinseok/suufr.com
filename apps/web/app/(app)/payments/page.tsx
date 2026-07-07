import type { PaymentView } from '@/types/index';

import { paymentsApi } from '@/utils/api/payments';

import React from 'react';

import ViewTabs from './_view-tabs';
import MonthlyView from './_monthly-view';
import YearlyView from './_yearly-view';
import {
  groupPaymentsByMonth,
  groupPaymentsByYear,
  getPrevMonth,
  getNextMonth, getPrevYear, getNextYear,
} from '@/utils/payment-stats';
import { toKstParts } from '@/utils/kst';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    view: string;
    date: string;
    student: string;
  }>;
};

function parseDateParam(date: string | undefined): { year: number; month: number } {
  if (date) {
    const parts = date.split('-');
    if (parts.length >= 2) {
      return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) };
    }
    if (parts.length === 1) {
      return { year: parseInt(parts[0], 10), month: 1 };
    }
  }

  // date 파라미터가 없으면 KST 기준 현재 연/월
  const { year, month } = toKstParts(new Date());
  return { year, month };
}

export default async function Page({ searchParams }: Props) {
  const { view: _view, date: _date } = await searchParams;

  const view: PaymentView = _view === 'yearly' ? 'yearly' : 'monthly';
  const { year, month } = parseDateParam(_date);

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
    paymentMethod: p.paymentMethod,
    notes: p.notes,
    paidAt: new Date(p.paidAt),
    lesson: {
      uuid: p.lesson.uuid,
      title: p.lesson.title,
      student: {
        id: p.lesson.student.id,
        name: p.lesson.student.name,
      },
    },
  }));

  const monthlyStats = groupPaymentsByMonth(payments);
  const yearlyStats = groupPaymentsByYear(payments);

  const currentMonthStats = monthlyStats.length > 0 ? monthlyStats[0] : null;
  const currentYearStats = yearlyStats.length > 0 ? yearlyStats[0] : null;

  const buildNavUrl = (newDate: string) => {
    const params = new URLSearchParams();
    params.set('view', view);
    params.set('date', newDate);
    return `/payments?${params.toString()}`;
  };

  const prevDate = view === 'monthly' ? getPrevMonth(_date) : getPrevYear(_date);
  const nextDate = view === 'monthly' ? getNextMonth(_date) : getNextYear(_date);

  const displayDate = view === 'monthly'
    ? `${year}년 ${month}월`
    : `${year}년`;

  return (
    <div>
      <div className="flex justify-between">
        <h1 className="text-xl font-bold text-default-900 lg:text-3xl">입금 내역</h1>
        <ViewTabs view={view} />
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
