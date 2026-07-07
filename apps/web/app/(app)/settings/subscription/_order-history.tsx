'use client';

import { Surface } from '@heroui/react';
import { ExternalLink } from 'lucide-react';

import type { TSubscription } from '@/types/index';

interface OrderHistoryProps {
  subscription: TSubscription | null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export default function OrderHistory({ subscription }: OrderHistoryProps) {
  if (!subscription || subscription.orders.length === 0) {
    return null;
  }

  return (
    <Surface className="p-5 border border-gray-50 rounded-xl shadow-xs">
      <h2 className="text-lg font-semibold">결제 내역</h2>
      <ul className="mt-4 divide-y divide-gray-50">
        {subscription.orders.map(order => (
          <li key={order.orderId} className="py-3 flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {formatDate(order.approvedAt ?? order.createdAt)}
                <span
                  className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                    order.status === 'done'
                      ? 'bg-success-soft text-success'
                      : 'bg-danger-soft text-danger'
                  }`}
                >
                  {order.status === 'done' ? '결제완료' : '실패'}
                </span>
              </p>
              {order.status === 'failed' && order.failReason && (
                <p className="mt-1 text-xs text-gray-500 truncate">{order.failReason}</p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-medium">{order.amount.toLocaleString('ko-KR')}원</span>
              {order.receiptUrl && (
                <a
                  href={order.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="영수증 보기"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
