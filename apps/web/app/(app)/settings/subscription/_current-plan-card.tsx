'use client';

import Link from 'next/link';
import { Surface } from '@heroui/react';
import { AlertTriangle, Crown, MailWarning, Sparkles } from 'lucide-react';

import type { TSubscription } from '@/types/index';

import UpgradeButton, { type PaddleCheckoutConfig } from './_upgrade-button';
import { CancelSubscriptionButton, ResumeSubscriptionButton } from './_manage-subscription';

interface CurrentPlanCardProps {
  subscription: TSubscription | null;
  customerEmail?: string;
  paddle: PaddleCheckoutConfig | null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export default function CurrentPlanCard({
  subscription,
  customerEmail,
  paddle,
}: CurrentPlanCardProps) {
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
  // api 배포 시차로 필드가 없으면 결제 가능으로 간주(기존 동작 유지)
  const needsEmailVerification = subscription.subscribeBlockers?.includes('email_unverified') ?? false;
  const canUpgrade = !isPro && (subscription.canSubscribe ?? true);
  const isCanceled = subscription.status === 'canceled';
  const isPastDue = subscription.status === 'past_due';
  // 해지·재개·인보이스는 Paddle 구독만 서버가 다룰 수 있다. 스토어 구독은 스토어 관리 화면 안내만
  const isPaddle = subscription.provider === 'paddle';
  const storeName = subscription.provider === 'apple' ? 'App Store' : subscription.provider === 'google' ? 'Google Play' : null;
  const isStoreManaged = isPro && storeName !== null;
  const paymentMethodText = isPaddle ? '등록된 카드를' : '스토어에 등록된 결제 수단을';
  const periodEndText = subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : null;
  const graceEndText = subscription.gracePeriodExpiresAt ? formatDate(subscription.gracePeriodExpiresAt) : null;

  return (
    <Surface className="p-5 border border-gray-50 rounded-xl shadow-xs">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${isPro ? 'bg-indigo-100' : 'bg-gray-100'}`}>
          {isPro
            ? <Crown className="w-6 h-6 text-indigo-600" />
            : <Sparkles className="w-6 h-6 text-gray-600" />}
        </div>

        <div className="flex-1 min-w-0">
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
            {canUpgrade && (
              <UpgradeButton
                customerEmail={customerEmail}
                paddle={paddle}
              />
            )}
            {isPro && isCanceled && isPaddle && periodEndText && <ResumeSubscriptionButton />}
          </div>

          {!isPro && (
            <p className="mt-2 text-sm text-gray-500">
              프로 플랜으로 업그레이드하면 수강생을 제한 없이 등록하고 더 넉넉한 저장 공간을 사용할 수 있어요.
            </p>
          )}

          {!isPro && needsEmailVerification && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-900 p-3 rounded-lg border border-amber-200 bg-amber-50">
              <MailWarning className="w-4 h-4 shrink-0 text-amber-600" aria-hidden />
              <span className="grow">이메일 인증을 마치면 프로 플랜을 구독할 수 있어요.</span>
              <Link href="/settings" className="shrink-0 font-medium underline underline-offset-2 hover:text-amber-950">
                설정에서 인증하기
              </Link>
            </div>
          )}

          {isStoreManaged && (
            <p className="mt-2 text-sm text-gray-500">
              {`${storeName}에서 구독을 관리할 수 있어요.`}
            </p>
          )}

          {isPro && periodEndText && !(isPastDue && graceEndText) && (
            <p className="mt-2 text-sm text-gray-500">
              {isCanceled
                ? `해지가 예약되어 있어요. ${periodEndText}까지 이용할 수 있고, 이후 무료 플랜으로 전환됩니다.`
                : subscription.provider === 'manual'
                  ? `${periodEndText}까지 이용할 수 있어요.`
                  : `다음 결제일: ${periodEndText}`}
            </p>
          )}

          {isPro && isPastDue && (
            <div className="mt-3 flex items-center gap-2 text-sm text-danger p-3 rounded-lg bg-danger-soft">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {graceEndText
                  ? `정기결제에 실패했어요. ${graceEndText}까지 ${paymentMethodText} 확인해주세요.`
                  : `정기결제에 실패했어요. ${paymentMethodText} 확인해주세요. 결제가 계속 실패하면 무료 플랜으로 전환됩니다.`}
              </span>
            </div>
          )}

          {isPro && !isCanceled && isPaddle && subscription.currentPeriodEnd && (
            <div className="mt-3 flex justify-end">
              <CancelSubscriptionButton periodEndText={periodEndText ?? ''} />
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}
