import Link from 'next/link';

const LINK = 'hover:text-brand-navy focus-visible:outline-3 focus-visible:outline-brand-sky focus-visible:outline-offset-3 focus-visible:rounded-md';

/** 공개(비로그인) 페이지 공용 푸터 — 약관/정책 링크와 문의처 포함 */
export default function SiteFooter() {
  return (
    <footer className="pt-9 pb-12 text-[14.5px] text-site-muted">
      <div className="max-w-[1080px] mx-auto px-6 flex flex-wrap justify-between gap-x-7 gap-y-3.5">
        <span>© 2026 Suufr</span>
        <nav className="flex flex-wrap gap-x-5 gap-y-1.5">
          <Link href="/pricing" className={LINK}>
            요금제
          </Link>
          <Link href="/terms" className={LINK}>
            이용약관
          </Link>
          <Link href="/privacy" className={LINK}>
            개인정보처리방침
          </Link>
          <Link href="/refunds" className={LINK}>
            환불정책
          </Link>
          <a href="mailto:support@suufr.com" className={LINK}>
            support@suufr.com
          </a>
        </nav>
      </div>
    </footer>
  );
}
