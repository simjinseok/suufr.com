import type { PaymentView } from '@/types/index';

import prisma from '@/utils/prisma';

import { getSession } from '@/utils/auth';

import React from 'react';

import Filter from './_filter';
import ViewTabs from './_view-tabs';
import MonthlyView from './_monthly-view';
import YearlyView from './_yearly-view';
import {
  groupPaymentsByMonth,
  groupPaymentsByYear,
  getMonthRange,
  getYearRange,
  getPrevMonth,
  getNextMonth, getPrevYear, getNextYear,
} from '@/utils/payment-stats';
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

export default async function Page({ searchParams }: Props) {
  const { view: _view, date: _date } = await searchParams;

  const session = await getSession();
  if (!session?.organization) {
    return null;
  }
  const { organization } = session;

  const view: PaymentView = _view === 'yearly' ? 'yearly' : 'monthly';

  const { from, to } = view === 'monthly'
    ? getMonthRange(_date)
    : getYearRange(_date);

  const where = {
    deletedAt: null,
    paidAt: {
      gte: from,
      lte: to,
    },
    lesson: {
      deletedAt: null,
      student: {
        organizationId: organization.id,
        deletedAt: null,
      },
    },
  };

  const payments = await prisma.payment.findMany({
    where,
    include: {
      lesson: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      paidAt: 'desc',
    },
  });

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
    ? `${from.getFullYear()}년 ${from.getMonth() + 1}월`
    : `${from.getFullYear()}년`;

  return (
    <div>
      <div className="flex justify-between">
        <h1 className="text-xl font-bold text-default-900 lg:text-3xl">입금 내역</h1>
        <ViewTabs view={view} date={_date} />
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
            <YearlyView stats={currentYearStats} payments={payments} />
          )}
    </div>
  );
}
