import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

import { activateBilling } from '@/actions/subscription';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  authKey?: string;
  customerKey?: string;
}>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { authKey } = await searchParams;

  if (!authKey) {
    redirect('/settings/subscription');
  }

  const result = await activateBilling(authKey);

  if (result.success) {
    redirect('/settings/subscription');
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">요금제</h1>
      <div className="mt-6 p-5 border border-gray-50 rounded-xl shadow-xs bg-white">
        <p className="font-medium text-danger flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          결제에 실패했어요
        </p>
        <p className="mt-2 text-sm text-gray-600">
          {result.message || '카드 등록 또는 첫 결제 과정에서 문제가 발생했습니다.'}
        </p>
        <Link
          href="/settings/subscription"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
        >
          요금제 페이지로 돌아가서 다시 시도하기
        </Link>
      </div>
    </div>
  );
}
