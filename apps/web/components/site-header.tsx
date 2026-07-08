import Link from 'next/link';

/** 공개(비로그인) 페이지 공용 헤더 — 랜딩/약관/정책 페이지에서 사용 */
export default function SiteHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <span className="text-sm font-bold text-white">스</span>
          </div>
          <span className="text-lg font-bold text-gray-900">스프</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/pricing"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            요금제
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            로그인
          </Link>
        </nav>
      </div>
    </header>
  );
}
