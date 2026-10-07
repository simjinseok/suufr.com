import Link from 'next/link';
import { MailWarning } from 'lucide-react';

/**
 * 이메일 미인증 안내 배너. 가입 직후 로그인된 계정이 인증을 마칠 때까지 앱 상단에 상시 표시된다.
 * 닫기 버튼 없음 — 설정(회원정보)에서 인증을 마치면 /me 의 emailVerified 가 true 가 되어 레이아웃에서 빠진다. 앱 사용은 막지 않는다.
 */
export default function EmailVerificationBanner() {
  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <MailWarning className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
      <p className="grow">이메일 인증이 완료되지 않았습니다. 메일로 받은 인증코드를 설정에서 입력해주세요.</p>
      <Link href="/settings" className="shrink-0 font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950">
        설정에서 인증하기
      </Link>
    </div>
  );
}
