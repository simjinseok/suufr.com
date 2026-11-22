import Link from 'next/link';

import { FOCUS, WRAP } from './product-ui';

export default function FinalCta() {
  return (
    <section className="bg-brand-navy text-[#C9DBF0] py-[84px]">
      <div className={`${WRAP} flex flex-wrap items-center justify-between gap-7`}>
        <div className="min-w-0">
          <h2 className="text-white text-[clamp(26px,3.2vw,38px)] font-[750] tracking-[-0.03em] leading-[1.28]">
            이번 달 수업료부터 정리해 보세요
          </h2>
        </div>
        <Link
          href="/signup"
          className={`inline-flex w-full md:w-auto items-center justify-center bg-white hover:bg-brand-soft text-brand-navy font-semibold px-[26px] py-[15px] text-[17px] rounded-[10px] ${FOCUS}`}
        >
          무료로 시작하기
        </Link>
      </div>
    </section>
  );
}
