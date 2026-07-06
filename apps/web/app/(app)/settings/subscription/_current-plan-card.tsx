'use client';

import { Surface } from '@heroui/react';
import { Crown, Sparkles } from 'lucide-react';

import type { TSubscription } from '@/types/index';

import UpgradeButton from './_upgrade-button';

interface CurrentPlanCardProps {
  subscription: TSubscription | null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export default function CurrentPlanCard({ subscription }: CurrentPlanCardProps) {
  if (!subscription) {
    return (
      <Surface className="p-5 border border-gray-50 rounded-xl shadow-xs">
        <div className="text-center text-gray-500">
          구독 정보를 불러올 수 없습니다.
        </div>
      </Surface>
    );
  }

  const isPro = subscription.plan === 'pro';

  return (
    <Surface className="p-5 border border-gray-50 rounded-xl shadow-xs">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${isPro ? 'bg-indigo-100' : 'bg-gray-100'}`}>
          {isPro
            ? <Crown className="w-6 h-6 text-indigo-600" />
            : <Sparkles className="w-6 h-6 text-gray-600" />}
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">현재 플랜</h2>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                  isPro ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {isPro ? '프로' : '무료'}
              </span>
            </div>
            {!isPro && <UpgradeButton priceKrw={subscription.catalog.pro.priceKrw} />}
          </div>

          {isPro && subscription.currentPeriodEnd && (
            <p className="mt-2 text-sm text-gray-500">
              {subscription.canceledAt
                ? `${formatDate(subscription.currentPeriodEnd)}까지 이용할 수 있어요. 이후 무료 플랜으로 전환됩니다.`
                : `다음 결제일: ${formatDate(subscription.currentPeriodEnd)}`}
            </p>
          )}

          {!isPro && (
            <p className="mt-2 text-sm text-gray-500">
              프로 플랜으로 업그레이드하면 수강생을 제한 없이 등록하고 더 넉넉한 저장 공간을 사용할 수 있어요.
            </p>
          )}
        </div>
      </div>
    </Surface>
  );
}
