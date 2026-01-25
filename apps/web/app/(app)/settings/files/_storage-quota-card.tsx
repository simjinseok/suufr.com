'use client';

import { Surface } from '@heroui/react';
import { HardDrive, AlertTriangle } from 'lucide-react';

import type { TStorageQuota } from '@/types/index';

interface StorageQuotaCardProps {
  quota: TStorageQuota | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

export default function StorageQuotaCard({ quota }: StorageQuotaCardProps) {
  if (!quota) {
    return (
      <Surface className="p-5 border border-gray-50 rounded-xl shadow-xs">
        <div className="text-center text-gray-500">
          용량 정보를 불러올 수 없습니다.
        </div>
      </Surface>
    );
  }

  const usagePercent = Math.min((quota.usedBytes / quota.quotaBytes) * 100, 100);
  const isWarning = usagePercent >= 80;
  const isDanger = usagePercent >= 100;

  const getProgressColor = () => {
    if (isDanger) return 'bg-danger';
    if (isWarning) return 'bg-warning';
    return 'bg-accent';
  };

  return (
    <Surface className="p-5 border border-gray-50 rounded-xl shadow-xs">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-gray-100 rounded-lg">
          <HardDrive className="w-6 h-6 text-gray-600" />
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">스토리지 용량</h2>
            <span className="text-sm text-gray-600">
              {formatBytes(quota.usedBytes)} / {formatBytes(quota.quotaBytes)}
            </span>
          </div>

          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor()} transition-all duration-300`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>

          {isWarning && !isDanger && (
            <div className="mt-3 flex items-center gap-2 text-sm text-warning-600">
              <AlertTriangle className="w-4 h-4" />
              <span>저장 공간이 부족합니다. 사용하지 않는 파일을 삭제해주세요.</span>
            </div>
          )}

          {isDanger && (
            <div className="mt-3 flex items-center gap-2 text-sm text-danger-600">
              <AlertTriangle className="w-4 h-4" />
              <span>저장 공간이 가득 찼습니다. 새 파일을 업로드하려면 기존 파일을 삭제해주세요.</span>
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}
