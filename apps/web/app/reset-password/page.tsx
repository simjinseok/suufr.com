import * as React from 'react';
import { redirect } from 'next/navigation';

import { getSession } from '@/utils/auth';
import ResetPasswordForm from './reset-password-form';

export default async function ResetPasswordPage() {
  const session = await getSession();
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-2xl font-bold text-white">스</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            비밀번호 재설정
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            새로운 비밀번호를 설정해주세요
          </p>
        </div>

        <React.Suspense fallback={<div className="text-center">로딩 중...</div>}>
          <ResetPasswordForm />
        </React.Suspense>
      </div>
    </div>
  );
}
