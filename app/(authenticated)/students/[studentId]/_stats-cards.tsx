'use client';

import { Card } from '@heroui/react';

type Props = {
  stats: {
    totalLessons: number;
    completedLessons: number;
    upcomingLessons: number;
  };
};

export default function StatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <Card className="border border-transparent dark:border-default-100">
        <div className="p-4">
          <div className="flex flex-col gap-y-2">
            <dt className="text-small font-medium text-default-500">총 수업</dt>
            <dd className="text-2xl font-semibold text-default-700">
              {stats.totalLessons}회
            </dd>
          </div>
        </div>
      </Card>

      <Card className="border border-transparent dark:border-default-100">
        <div className="p-4">
          <div className="flex flex-col gap-y-2">
            <dt className="text-small font-medium text-default-500">완료</dt>
            <dd className="text-2xl font-semibold text-success-600">
              {stats.completedLessons}회
            </dd>
          </div>
        </div>
      </Card>

      <Card className="border border-transparent dark:border-default-100">
        <div className="p-4">
          <div className="flex flex-col gap-y-2">
            <dt className="text-small font-medium text-default-500">예정</dt>
            <dd className="text-2xl font-semibold text-primary-600">
              {stats.upcomingLessons}회
            </dd>
          </div>
        </div>
      </Card>
    </div>
  );
}
