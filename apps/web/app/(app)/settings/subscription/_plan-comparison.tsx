'use client';

import { Surface } from '@heroui/react';
import { Check } from 'lucide-react';

import type { TSubscription } from '@/types/index';

interface PlanComparisonProps {
  subscription: TSubscription | null;
}

function formatBytes(bytes: number): string {
  const k = 1024;
  if (bytes >= k * k * k) return `${parseFloat((bytes / (k * k * k)).toFixed(1))}GB`;
  return `${parseFloat((bytes / (k * k)).toFixed(1))}MB`;
}

export default function PlanComparison({ subscription }: PlanComparisonProps) {
  if (!subscription) {
    return null;
  }

  const { catalog, plan } = subscription;

  const rows = [
    {
      label: '월 요금',
      free: '0원',
      pro: `${catalog.pro.priceKrw.toLocaleString('ko-KR')}원`,
    },
    {
      label: '수강생 등록',
      free: `${catalog.free.maxStudents}명`,
      pro: '무제한',
    },
    {
      label: '스토리지',
      free: formatBytes(catalog.free.storageQuotaBytes),
      pro: formatBytes(catalog.pro.storageQuotaBytes),
    },
  ];

  return (
    <Surface className="p-5 border border-gray-50 rounded-xl shadow-xs">
      <h2 className="text-lg font-semibold">플랜 비교</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-2 text-left font-medium text-gray-500 w-1/3" />
              <th className="py-2 text-center font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  무료
                  {plan === 'free' && <Check className="w-4 h-4 text-accent" />}
                </span>
              </th>
              <th className="py-2 text-center font-semibold text-indigo-700">
                <span className="inline-flex items-center gap-1.5">
                  프로
                  {plan === 'pro' && <Check className="w-4 h-4 text-accent" />}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label} className="border-b border-gray-50 last:border-b-0">
                <td className="py-3 text-gray-500">{row.label}</td>
                <td className="py-3 text-center">{row.free}</td>
                <td className="py-3 text-center font-medium">{row.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}
