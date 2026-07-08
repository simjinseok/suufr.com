import Link from 'next/link';

/** 공개(비로그인) 페이지 공용 푸터 — 약관/정책 링크와 문의처 포함 */
export default function SiteFooter() {
  return (
    <footer className="py-10 px-6 border-t border-gray-100">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <span className="text-xs font-bold text-white">스</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">스프</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500">
            <Link href="/pricing" className="hover:text-gray-900 transition-colors">
              요금제
            </Link>
            <Link href="/terms" className="hover:text-gray-900 transition-colors">
              이용약관
            </Link>
            <Link href="/privacy" className="font-medium hover:text-gray-900 transition-colors">
              개인정보처리방침
            </Link>
            <Link href="/refunds" className="hover:text-gray-900 transition-colors">
              환불정책
            </Link>
            <a href="mailto:support@suufr.com" className="hover:text-gray-900 transition-colors">
              문의하기
            </a>
          </nav>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-400">
          <p>
            문의:
            {' '}
            <a href="mailto:support@suufr.com" className="hover:text-gray-600 transition-colors">
              support@suufr.com
            </a>
          </p>
          <p>© 2026 Suufr. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
