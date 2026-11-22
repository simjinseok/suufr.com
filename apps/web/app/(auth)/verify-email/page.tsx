import * as React from 'react';

import VerifyEmailForm from './verify-email-form';

/** 이메일 인증코드 입력. 가입 직후와, 미인증 계정이 로그인했을 때 온다 (?email=) */
export default function VerifyEmailPage() {
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
            이메일로 받은 6자리 인증코드를 입력해주세요
          </p>
        </div>

        <React.Suspense fallback={<div className="text-center">로딩 중...</div>}>
          <VerifyEmailForm />
        </React.Suspense>
      </div>
    </div>
  );
}
