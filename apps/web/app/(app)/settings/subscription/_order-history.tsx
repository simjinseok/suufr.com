'use client';

import * as React from 'react';
import { Surface, Spinner, toast } from '@heroui/react';
import { ExternalLink } from 'lucide-react';

import { getInvoiceUrl } from '@/actions/subscription';
import type { TSubscription, TSubscriptionOrder } from '@/types/index';

interface OrderHistoryProps {
  subscription: TSubscription | null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

// amount 는 통화 최소 단위 정수. KRW 는 기존 표기("6,900원") 유지, 그 외 통화는 자릿수만큼 나눠 표시
function formatAmount(amount: number, currency: string): string {
  if (currency === 'KRW') {
    return `${amount.toLocaleString('ko-KR')}원`;
  }
  const formatter = new Intl.NumberFormat('ko-KR', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 0;
  return formatter.format(amount / 10 ** digits);
}

const STATUS_LABEL: Record<TSubscriptionOrder['status'], { text: string; className: string }> = {
  done: { text: '결제완료', className: 'bg-success-soft text-success' },
  failed: { text: '실패', className: 'bg-danger-soft text-danger' },
  refunded: { text: '환불', className: 'bg-gray-100 text-gray-600' },
};

export default function OrderHistory({ subscription }: OrderHistoryProps) {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  if (!subscription || subscription.orders.length === 0) {
    return null;
  }

  // 인보이스 URL은 발급 후 1시간 만료라 클릭 시점에 발급받아 연다
  // (팝업 차단 회피: 클릭 시 창을 먼저 열고 URL을 나중에 주입)
  const handleOpenInvoice = async (transactionId: string) => {
    if (loadingId) {
      return;
    }
    const invoiceWindow = window.open('about:blank', '_blank');
    setLoadingId(transactionId);
    try {
      const result = await getInvoiceUrl(transactionId);
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
          <li key={`${order.provider}:${order.transactionId}`} className="py-3 flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {formatDate(order.approvedAt ?? order.createdAt)}
                <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-md ${STATUS_LABEL[order.status].className}`}>
                  {STATUS_LABEL[order.status].text}
                </span>
              </p>
              {order.status === 'failed' && order.failReason && (
                <p className="mt-1 text-xs text-gray-500 truncate">{order.failReason}</p>
              )}
              {order.status === 'refunded' && order.refundedAt && (
                <p className="mt-1 text-xs text-gray-500">
                  {`${formatDate(order.refundedAt)} 환불`}
                  {order.refundedAmount !== null && order.refundedAmount !== order.amount && ` (${formatAmount(order.refundedAmount, order.currency)})`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-medium">{formatAmount(order.amount, order.currency)}</span>
              {order.provider === 'paddle' && order.status === 'done' && (
                <button
                  type="button"
                  onClick={() => handleOpenInvoice(order.transactionId)}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  aria-label="인보이스 보기"
                  disabled={loadingId !== null}
                >
                  {loadingId === order.transactionId
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
