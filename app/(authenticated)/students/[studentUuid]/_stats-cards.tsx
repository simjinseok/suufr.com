'use client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

import { Card } from '@heroui/react';

type Props = {
  stats: {
    remainingSessionsCount: number;
    completedLessonCount: number;
    unpaidLessonCount: number;
    nextPaymentAt?: Date;
  };
};

export default function StatsCards({ stats }: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <Card className="flex-1 border border-transparent dark:border-default-100">
        <div className="flex flex-col gap-y-2">
          <dt className="text-small font-medium text-default-500">남은 수업</dt>
          <dd className="text-2xl font-semibold text-primary-600">
            {stats.remainingSessionsCount}
            회
          </dd>
        </div>
      </Card>
      <Card className="flex-1 border border-transparent dark:border-default-100">
        <div className="flex flex-col gap-y-2">
          <dt className="text-small font-medium text-default-500">완료한 레슨</dt>
          <dd className="text-2xl font-semibold text-success-600">
            {stats.completedLessonCount}
            회
          </dd>
        </div>
      </Card>
      <Card className="flex-1 border border-transparent dark:border-default-100">
        <div className="flex flex-col gap-y-2">
          <dt className="text-small font-medium text-default-500">다음 결제 예정일</dt>
          <dd className="text-2xl font-semibold text-success">
            {stats.nextPaymentAt ? format(stats.nextPaymentAt, 'MM월 dd일', { locale: ko }) : '-'}
          </dd>
        </div>
      </Card>

    </div>
  );
}
