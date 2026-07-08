import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';

import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';

export const metadata: Metadata = {
  title: '요금제 - 스프',
  description: '스프(Suufr) 요금제 — 무료로 시작하고, 필요할 때 프로로 업그레이드하세요. 프로 플랜 월 6,900원(부가세 포함).',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />

      <main className="grow pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight text-center">
            요금제
          </h1>
          <p className="mt-4 text-lg text-gray-500 text-center">
            무료로 시작하고, 필요할 때 업그레이드하세요
          </p>

          <div className="mt-14 grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free */}
            <div className="p-8 bg-white rounded-2xl border border-gray-100 flex flex-col">
              <h2 className="text-lg font-semibold text-gray-900">무료</h2>
              <p className="mt-1 text-sm text-gray-500">개인 과외를 막 시작했다면</p>
              <p className="mt-6">
                <span className="text-4xl font-bold text-gray-900">₩0</span>
                <span className="ml-1 text-sm text-gray-400">/ 월</span>
              </p>
              <ul className="mt-8 space-y-3 grow">
                <PricingItem>수강생 5명까지 등록</PricingItem>
                <PricingItem>저장 공간 100MB</PricingItem>
                <PricingItem>일정·수업·정산 관리 전 기능</PricingItem>
                <PricingItem>수업 공유 링크</PricingItem>
              </ul>
              <Link
                href="/signup"
                className="mt-8 inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
              >
                무료로 시작하기
              </Link>
            </div>

            {/* Pro */}
            <div className="relative p-8 bg-white rounded-2xl border-2 border-violet-500 shadow-lg shadow-violet-500/10 flex flex-col">
              <span className="absolute -top-3 left-8 px-3 py-0.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-xs font-semibold text-white">
                추천
              </span>
              <h2 className="text-lg font-semibold text-gray-900">프로</h2>
              <p className="mt-1 text-sm text-gray-500">수강생이 늘어나는 선생님께</p>
              <p className="mt-6">
                <span className="text-4xl font-bold text-gray-900">₩6,900</span>
                <span className="ml-1 text-sm text-gray-400">/ 월 (부가세 포함)</span>
              </p>
              <ul className="mt-8 space-y-3 grow">
                <PricingItem>수강생 무제한 등록</PricingItem>
                <PricingItem>저장 공간 5GB</PricingItem>
                <PricingItem>일정·수업·정산 관리 전 기능</PricingItem>
                <PricingItem>수업 공유 링크</PricingItem>
              </ul>
              <Link
                href="/signup"
                className="mt-8 inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow"
              >
                프로 시작하기
              </Link>
            </div>
          </div>

          <div className="mt-14 max-w-2xl mx-auto space-y-4 text-sm text-gray-500">
            <div className="p-5 rounded-xl bg-gray-50">
              <p className="font-medium text-gray-700">결제와 해지는 이렇게 동작해요</p>
              <ul className="mt-3 space-y-2 list-disc pl-5">
                <li>프로 플랜은 매월 자동 갱신되며, 결제는 Paddle을 통해 안전하게 처리됩니다.</li>
                <li>언제든 설정에서 해지할 수 있고, 해지해도 남은 기간까지 프로 기능을 이용할 수 있어요.</li>
                <li>
                  자세한 내용은
                  {' '}
                  <Link href="/refunds" className="underline underline-offset-2 hover:text-gray-700 transition-colors">
                    환불정책
                  </Link>
                  을 확인해주세요.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function PricingItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-gray-600">
      <Check className="w-4 h-4 mt-0.5 shrink-0 text-violet-600" />
      {children}
    </li>
  );
}
