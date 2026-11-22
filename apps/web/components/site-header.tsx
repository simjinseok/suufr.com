import Link from 'next/link';

const FOCUS = 'focus-visible:outline-3 focus-visible:outline-brand-sky focus-visible:outline-offset-3 focus-visible:rounded-md';

/** 공개(비로그인) 페이지 공용 헤더 — 랜딩/요금/약관/정책 페이지에서 사용 */
export default function SiteHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-site-line">
      <div className="max-w-[1080px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className={`flex items-center gap-2.5 text-[19px] font-bold text-brand-navy ${FOCUS}`}>
          <svg viewBox="0 0 1024 1024" aria-hidden="true" className="block w-[30px] h-[30px] rounded-[7px]">
            <rect width="1024" height="1024" fill="#082F5B" />
            <path
              d="M512 287 L328 543 M512 287 L696 543"
              stroke="#fff"
              strokeWidth="118"
              strokeLinecap="round"
              fill="none"
            />
            <path d="M307 707 L717 707" stroke="#3EA1FF" strokeWidth="118" strokeLinecap="round" />
          </svg>
          스프
        </Link>
        <nav className="flex items-center gap-3.5 md:gap-[22px] text-[15px] font-medium text-site-ink">
          <Link href="/pricing" className={`hidden md:inline hover:text-brand-navy ${FOCUS}`}>
            요금제
          </Link>
          <Link href="/login" className={`hover:text-brand-navy ${FOCUS}`}>
            로그인
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center bg-brand hover:bg-brand-strong text-white font-semibold px-4 py-[9px] text-[15px] rounded-lg focus-visible:outline-3 focus-visible:outline-brand-sky focus-visible:outline-offset-3"
          >
            무료로 시작하기
          </Link>
        </nav>
      </div>
    </header>
  );
}
