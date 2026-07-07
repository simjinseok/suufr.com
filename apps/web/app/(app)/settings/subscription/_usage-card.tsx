'use client';

import { Surface } from '@heroui/react';
import { Users, HardDrive } from 'lucide-react';

import type { TSubscription } from '@/types/index';

interface UsageCardProps {
  subscription: TSubscription | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

interface GaugeProps {
  icon: React.ReactNode;
  label: string;
  valueText: string;
  percent: number | null;
}

function Gauge({ icon, label, valueText, percent }: GaugeProps) {
  const isWarning = percent !== null && percent >= 80;
  const isDanger = percent !== null && percent >= 100;

  const progressColor = isDanger ? 'bg-danger' : isWarning ? 'bg-warning' : 'bg-accent';

  return (
    <div className="flex items-start gap-4">
      <div className="p-3 bg-gray-100 rounded-lg">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{label}</h3>
          <span className="text-sm text-gray-600">{valueText}</span>
        </div>
        {percent !== null && (
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${progressColor} transition-all duration-300`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function UsageCard({ subscription }: UsageCardProps) {
  if (!subscription) {
    return null;
  }

  const { limits, usage } = subscription;

  const studentValueText = limits.maxStudents === null
    ? `${usage.studentCount ?? 0}명 (무제한)`
    : `${usage.studentCount ?? 0}명 / ${limits.maxStudents}명`;

  const studentPercent = limits.maxStudents === null || usage.studentCount === null
    ? null
    : (usage.studentCount / limits.maxStudents) * 100;

  const storagePercent = (usage.storageUsedBytes / limits.storageQuotaBytes) * 100;

  return (
    <Surface className="p-5 border border-gray-50 rounded-xl shadow-xs">
      <h2 className="text-lg font-semibold">사용량</h2>
      <div className="mt-4 flex flex-col gap-5">
        <Gauge
          icon={<Users className="w-6 h-6 text-gray-600" />}
          label="수강생"
          valueText={studentValueText}
          percent={studentPercent}
        />
        <Gauge
          icon={<HardDrive className="w-6 h-6 text-gray-600" />}
          label="스토리지"
          valueText={`${formatBytes(usage.storageUsedBytes)} / ${formatBytes(limits.storageQuotaBytes)}`}
          percent={storagePercent}
        />
      </div>
    </Surface>
  );
}
