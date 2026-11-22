import Link from 'next/link';

import { FOCUS, H2, WRAP } from './product-ui';

const PLANS = [
  {
    name: '무료',
    price: '0원',
    note: null,
    items: ['수강생 5명', '저장 공간 100MB', '모든 기능 사용'],
  },
  {
    name: '프로',
    price: '6,900원',
    note: '매월, 부가세 포함',
    items: ['수강생 무제한', '저장 공간 5GB', '언제든 해지'],
  },
];

export default function PricingSummary() {
  return (
    <section id="pricing" className="bg-white py-16 md:py-24">
      <div className={WRAP}>
        <h2 className={H2}>요금제</h2>
        <div className="mt-10 grid max-w-[760px] grid-cols-[minmax(0,1fr)] md:grid-cols-[repeat(2,minmax(0,1fr))] overflow-hidden rounded-[14px] border border-site-line bg-white">
          {PLANS.map((plan, i) => (
            <div
              key={plan.name}
              className={`min-w-0 px-8 pt-[30px] pb-8 ${
                i > 0 ? 'border-t border-site-line md:border-t-0 md:border-l' : ''
              }`}
            >
              <h3 className="text-[17px] font-bold text-brand-navy">{plan.name}</h3>
              <div className="mt-2 text-[34px] font-extrabold text-brand-navy tracking-[-0.03em] leading-[1.2] tabular-nums">
                {plan.price}
                {plan.note && (
                  <>
                    {' '}
                    <small className="text-[15px] font-medium text-site-muted tracking-normal">{plan.note}</small>
                  </>
                )}
              </div>
              <ul className="mt-[18px]">
                {plan.items.map((item) => (
                  <li key={item} className="py-[9px] border-t border-site-line text-[16px]">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-[18px] text-[15.5px]">
          <Link
            href="/pricing"
            className={`text-brand font-semibold underline underline-offset-3 ${FOCUS} focus-visible:rounded-md`}
          >
            요금제 자세히 보기
          </Link>
        </p>
      </div>
    </section>
  );
}
