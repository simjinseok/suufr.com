'use client';

import * as React from 'react';
import { Surface, Spinner, toast } from '@heroui/react';
import { ExternalLink } from 'lucide-react';

import { getInvoiceUrl } from '@/actions/subscription';
import type { TSubscription } from '@/types/index';

interface OrderHistoryProps {
  subscription: TSubscription | null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export default function OrderHistory({ subscription }: OrderHistoryProps) {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  if (!subscription || subscription.orders.length === 0) {
    return null;
  }

  // 인보이스 URL은 발급 후 1시간 만료라 클릭 시점에 발급받아 연다
  // (팝업 차단 회피: 클릭 시 창을 먼저 열고 URL을 나중에 주입)
  const handleOpenInvoice = async (paddleTransactionId: string) => {
    if (loadingId) {
      return;
    }
    const invoiceWindow = window.open('about:blank', '_blank');
    setLoadingId(paddleTransactionId);
    try {
      const result = await getInvoiceUrl(paddleTransactionId);
      if (result.success && result.url && invoiceWindow) {
        invoiceWindow.location.href = result.url;
        return;
      }
      invoiceWindow?.close();
      toast.danger('인보이스 열기 실패', {
        description: result.message || '인보이스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
        timeout: 3000,
      });
    }
    finally {
      setLoadingId(null);
    }
  };

  return (
    <Surface className="p-5 border border-gray-50 rounded-xl shadow-xs">
      <h2 className="text-lg font-semibold">결제 내역</h2>
      <ul className="mt-4 divide-y divide-gray-50">
        {subscription.orders.map(order => (
          <li key={order.paddleTransactionId} className="py-3 flex items-center justify-between gap-3 text-sm">
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
              {order.status === 'done' && (
                <button
                  type="button"
                  onClick={() => handleOpenInvoice(order.paddleTransactionId)}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  aria-label="인보이스 보기"
                  disabled={loadingId !== null}
                >
                  {loadingId === order.paddleTransactionId
                    ? <Spinner color="current" size="sm" />
                    : <ExternalLink className="w-4 h-4" />}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
