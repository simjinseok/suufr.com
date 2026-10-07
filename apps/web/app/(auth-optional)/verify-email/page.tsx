import * as React from 'react';
import { cookies } from 'next/headers';

import VerifyEmailForm from './verify-email-form';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage() {
  // 가입 직후에는 이미 로그인돼 있다(인증은 나중에 가능). 중복 이메일 가입·메일 재발송 경로는 비로그인
  const loggedIn = Boolean((await cookies()).get('refresh_token')?.value);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-2xl font-bold text-white">스</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            이메일 인증
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            이메일로 발송된 6자리 코드를 입력하세요
          </p>
        </div>

        <React.Suspense fallback={<div className="text-center">로딩 중...</div>}>
          <VerifyEmailForm loggedIn={loggedIn} />
        </React.Suspense>
      </div>
    </div>
  );
}
