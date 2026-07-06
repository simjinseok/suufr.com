import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  code?: string;
  message?: string;
}>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { message } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-bold">요금제</h1>
      <div className="mt-6 p-5 border border-gray-50 rounded-xl shadow-xs bg-white">
        <p className="font-medium text-danger flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          카드 등록에 실패했어요
        </p>
        <p className="mt-2 text-sm text-gray-600">
          {message || '카드 등록이 취소되었거나 실패했습니다.'}
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
