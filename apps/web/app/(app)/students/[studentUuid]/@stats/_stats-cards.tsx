'use client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

import { Card } from '@heroui/react';

type Props = {
  stats: {
    remainingSessionsCount: number;
    completedLessonCount: number;
    unpaidLessonCount: number;
    nextPaymentAt: Date | null;
  };
};

export default function StatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-6">
      <Card className="p-3 sm:p-4 border border-transparent dark:border-default-100">
        <div className="flex flex-col gap-y-1 sm:gap-y-2">
          <dt className="text-xs sm:text-small font-medium text-default-500">남은 수업</dt>
          <dd className="text-lg sm:text-2xl font-semibold text-primary-600">
            {stats.remainingSessionsCount}
            회
          </dd>
        </div>
      </Card>
      <Card className="p-3 sm:p-4 border border-transparent dark:border-default-100">
        <div className="flex flex-col gap-y-1 sm:gap-y-2">
          <dt className="text-xs sm:text-small font-medium text-default-500">완료한 레슨</dt>
          <dd className="text-lg sm:text-2xl font-semibold text-success-600">
            {stats.completedLessonCount}
            회
          </dd>
        </div>
      </Card>
      <Card className="col-span-2 sm:col-span-1 p-3 sm:p-4 border border-transparent dark:border-default-100">
        <div className="flex flex-col gap-y-1 sm:gap-y-2">
          <dt className="text-xs sm:text-small font-medium text-default-500">다음 결제 예정일</dt>
          <dd className="text-lg sm:text-2xl font-semibold text-success">
            {stats.nextPaymentAt ? format(stats.nextPaymentAt, 'MM월 dd일', { locale: ko }) : '-'}
          </dd>
        </div>
      </Card>
    </div>
  );
}
