'use client';
import React from 'react';
import { Card, Chip } from '@heroui/react';
import { numberToHangulMixed } from 'es-hangul';
import { format } from 'date-fns/format';
import type { YearlyPaymentStats } from '@/types/index';
import { ko } from 'date-fns/locale';
import { tz } from '@date-fns/tz';
import PaymentModal from '@/components/invoice/payment-modal';
import { modal } from '@/contexts/modal-manager';
import { useTimeZone } from '@/contexts/timezone';
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type Payment = {
  id: number;
  uuid: string;
  amount: number;
  method: string;
  notes: string | null;
  paidAt: Date;
  student: {
    uuid: string;
    id: number;
    name: string;
  };
};

const PAYMENT_METHODS: Record<string, string> = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  none: '미지정',
};

type MonthlyTrendItem = {
  year: number;
  month: number;
  totalAmount: number;
  count: number;
};

type Props = {
  stats: YearlyPaymentStats | null;
  payments: Payment[];
  monthlyTrend: MonthlyTrendItem[];
};

export default function YearlyView({ stats, payments, monthlyTrend }: Props) {
  const timeZone = useTimeZone();

  if (!stats || stats.count === 0) {
    return (
      <div className="mt-6 space-y-6">
        {monthlyTrend.length > 0 && (
          <div className="bg-gradient-to-br from-indigo-50/80 to-violet-50/50 rounded-2xl p-5">
            <h3 className="text-sm font-medium text-zinc-500 mb-2">
              월별 입금 추이
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyTrend.map(m => ({
                    label: `${m.month}월`,
                    year: m.year,
                    month: m.month,
                    totalAmount: m.totalAmount,
                    count: m.count,
                  }))}
                  margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorAmountEmpty" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#c7d2fe" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#a1a1aa', fontSize: 11 }}
                    dy={8}
                  />
                  <Tooltip
                    cursor={{ stroke: '#a5b4fc', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const item = payload[0].payload as { year: number; month: number; totalAmount: number; count: number };
                      return (
                        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-indigo-100 px-3 py-2">
                          <p className="text-xs font-medium text-zinc-500">
                            {item.year}
                            년
                            {' '}
                            {item.month}
                            월
                          </p>
                          <p className="text-sm font-semibold text-zinc-900 mt-0.5">
                            {numberToHangulMixed(item.totalAmount)}
                            원
                          </p>
                          <p className="text-xs text-zinc-400">
                            {item.count}
                            건
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalAmount"
                    stroke="#818cf8"
                    strokeWidth={2.5}
                    fill="url(#colorAmountEmpty)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="text-center py-12 text-default-500">
          해당 연도에 입금 내역이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border border-transparent dark:border-default-100">
          <div className="p-4">
            <div className="flex flex-col gap-y-2">
              <dt className="text-small font-medium text-default-500">결제 건수</dt>
              <dd className="text-xl font-semibold text-default-700 sm:text-2xl">
                {stats.count}
                건
              </dd>
            </div>
          </div>
        </Card>

        <Card className="border border-transparent dark:border-default-100">
          <div className="p-4">
            <div className="flex flex-col gap-y-2">
              <dt className="text-small font-medium text-default-500">결제 금액</dt>
              <dd className="text-xl font-semibold text-default-700 sm:text-2xl">
                {numberToHangulMixed(stats.totalAmount)}
                원
              </dd>
            </div>
          </div>
        </Card>
      </div>

      {monthlyTrend.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50/80 to-violet-50/50 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-zinc-500 mb-2">
            월별 입금 추이
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthlyTrend.map(m => ({
                  label: `${m.month}월`,
                  year: m.year,
                  month: m.month,
                  totalAmount: m.totalAmount,
                  count: m.count,
                }))}
                margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#c7d2fe" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  dy={8}
                />
                <Tooltip
                  cursor={{ stroke: '#a5b4fc', strokeWidth: 1, strokeDasharray: '4 4' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0].payload as { year: number; month: number; totalAmount: number; count: number };
                    return (
                      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-indigo-100 px-3 py-2">
                        <p className="text-xs font-medium text-zinc-500">
                          {item.year}
                          년
                          {' '}
                          {item.month}
                          월
                        </p>
                        <p className="text-sm font-semibold text-zinc-900 mt-0.5">
                          {numberToHangulMixed(item.totalAmount)}
                          원
                        </p>
                        <p className="text-xs text-zinc-400">
                          {item.count}
                          건
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="totalAmount"
                  stroke="#818cf8"
                  strokeWidth={2.5}
                  fill="url(#colorAmount)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {payments.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden">
          {payments.map((payment, index) => (
            <div
              key={payment.id}
              className={`p-4 ${index !== payments.length - 1 ? 'border-b border-zinc-100' : ''}`}
            >
              <div className="flex justify-between items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-zinc-900">
                    {payment.student.name}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {format(payment.paidAt, 'M월 d일', { locale: ko, in: tz(timeZone) })}
                    &nbsp;·&nbsp;
                    {PAYMENT_METHODS[payment.method] || payment.method}
                  </p>
                </div>
                <div className="shrink-0">
                  <div className="flex flex-col items-end">
                    <Chip
                      size="sm"
                      variant="tertiary"
                      color="accent"
                      onClick={() => {
                        modal.show(PaymentModal, {
                          studentUuid: payment.student.uuid,
                          payment: {
                            uuid: payment.uuid,
                            amount: payment.amount,
                            method: payment.method,
                            paidAt: payment.paidAt,
                            notes: payment.notes,
                          },
                        });
                      }}
                    >
                      수정
                    </Chip>
                    <p className="text-base font-bold text-zinc-900 tabular-nums">
                      {numberToHangulMixed(payment.amount)}
                      원
                    </p>
                  </div>
                </div>
              </div>

              {payment.notes && (
                <div className="mt-3 p-3 rounded-lg text-sm text-zinc-600 leading-relaxed whitespace-pre-line bg-zinc-50">
                  {payment.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
