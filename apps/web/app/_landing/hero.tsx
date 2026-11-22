import Link from 'next/link';

import { StatusTag, WRAP } from './product-ui';

const UNPAID = [
  { who: '김서연', what: '11월 8회권', amount: '320,000원' },
  { who: '박준호', what: '11월 4회권', amount: '180,000원' },
  { who: '이하은', what: '10월 8회권', amount: '360,000원' },
];

export default function Hero() {
  return (
    <section className="bg-white pt-10 pb-14 md:pt-[72px] md:pb-[88px]">
      <div className={`${WRAP} grid grid-cols-[minmax(0,1fr)] gap-9 md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] md:gap-14 items-center`}>
        <div className="min-w-0">
          <h1 className="text-brand-navy text-[clamp(34px,4.6vw,56px)] font-extrabold leading-[1.2] tracking-[-0.035em]">
            “이번 달 수업료, 누가 아직 안 보냈더라?”
          </h1>
          <p className="mt-3.5 text-brand-navy text-[clamp(22px,2.6vw,30px)] font-medium tracking-[-0.02em] leading-[1.35]">
            스프를 열면 바로 보입니다.
          </p>
          <p className="mt-[26px] max-w-[30em] text-site-ink">
            과외·레슨 선생님을 위한 수업 관리 도구입니다. 수업을 수강권으로 묶어 두면 몇 번 수업했는지, 수업료를 받았는지를 따로 적어 둘 필요가 없습니다.
          </p>
          <div className="mt-[34px] flex flex-wrap items-center gap-x-[18px] gap-y-3.5">
            <Link
              href="/signup"
              className="inline-flex w-full md:w-auto items-center justify-center bg-brand hover:bg-brand-strong text-white font-semibold px-[26px] py-[15px] text-[17px] rounded-[10px] focus-visible:outline-3 focus-visible:outline-brand-sky focus-visible:outline-offset-3"
            >
              무료로 시작하기
            </Link>
          </div>
        </div>

        <div className="min-w-0 bg-brand-navy rounded-2xl p-4 md:rounded-[20px] md:p-7" aria-label="미납 목록 화면 예시">
          <div className="bg-white rounded-xl overflow-hidden text-[15px] leading-[1.45] text-site-ink">
            <div className="flex items-baseline justify-between px-5 pt-[18px] pb-3.5 border-b border-site-line">
              <b className="text-[17px] text-brand-navy font-bold">미납</b>
              <span className="text-[14px] text-site-muted tabular-nums">3건</span>
            </div>
            {UNPAID.map((row) => (
              <div
                key={row.who}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-center px-5 py-3.5 border-b border-site-line"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-brand-navy">{row.who}</div>
                  <div className="text-[13.5px] text-site-muted tabular-nums">{row.what}</div>
                </div>
                <div>
                  <div className="font-semibold tabular-nums text-right text-brand-navy">{row.amount}</div>
                  <div className="text-right">
                    <StatusTag tone="unpaid">미납</StatusTag>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-site-band px-5 py-3 flex justify-between text-[14px] text-site-muted">
              <span>받을 수업료</span>
              <b className="text-brand-navy tabular-nums">860,000원</b>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
