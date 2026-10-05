import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

/** Cognito MFA 사용자가 better-auth 로 이전된 뒤 TOTP 를 재등록하기 전까지 모든 화면 상단에 표시 */
export default function TwoFactorSetupBanner() {
  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
      <p className="grow">
        로그인 시스템이 새로 바뀌어 기존 2단계 인증 설정을 이어받을 수 없습니다. 보안을 위해 인증 앱을 다시 등록해주세요.
      </p>
      <Link href="/settings/security" className="font-medium text-amber-800 underline underline-offset-2 shrink-0">
        지금 설정하기
      </Link>
    </div>
  );
}
