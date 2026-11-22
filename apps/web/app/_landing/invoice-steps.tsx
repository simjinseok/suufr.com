import { H2, StatusTag, WRAP } from './product-ui';

const MINI = 'mt-[22px] bg-white border border-site-line rounded-[10px] px-[18px] py-4 text-[15px] leading-[1.5]';
const LINE = 'flex justify-between items-center gap-2.5';
const T = 'font-bold text-brand-navy';
const M = 'text-site-muted text-[14px]';

const STEP = 'min-w-0 pt-6 pb-7 md:pt-7 md:pr-7 md:pb-0';
const STEP_NEXT = 'border-t border-site-line md:border-t-0 md:border-l md:pl-7';

function Step({
  num,
  title,
  desc,
  first,
  children,
}: {
  num: number;
  title: string;
  desc: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className={first ? STEP : `${STEP} ${STEP_NEXT}`}>
      <div className="text-[15px] font-bold text-brand">{num}</div>
      <h3 className="mt-1.5 text-[21px] font-bold text-brand-navy tracking-[-0.02em] leading-[1.35]">{title}</h3>
      <p className="mt-2.5 text-[16px]">{desc}</p>
      <div className={MINI}>{children}</div>
    </li>
  );
}

export default function InvoiceSteps() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className={WRAP}>
        <h2 className={H2}>수업과 수업료를 수강권 하나로 묶습니다</h2>
        <p className="mt-4 max-w-[34em]">
          수강권은 “11월에 8번, 32만 원” 같은 약속 한 건입니다. 한 번 만들어 두면 나머지는 따라옵니다.
        </p>

        <ol className="mt-[52px] grid grid-cols-1 md:grid-cols-3 border-t-2 border-brand-navy">
          <Step num={1} title="수강권을 만듭니다" desc="수강생, 기간, 횟수, 금액을 적습니다." first>
            <div className={LINE}>
              <span className={T}>11월 8회권</span>
              <StatusTag tone="unpaid">미납</StatusTag>
            </div>
            <div className={`${M} tabular-nums`}>김서연, 11월 1일부터 30일까지</div>
            <div className={`${LINE} mt-2.5`}>
              <span className={M}>수업료</span>
              <span className={`${T} tabular-nums`}>320,000원</span>
            </div>
          </Step>
          <Step num={2} title="수업한 날 완료를 누릅니다" desc="몇 번 했고 몇 번 남았는지는 세지 않아도 됩니다.">
            <div className={LINE}>
              <span className={T}>11월 8회권</span>
              <span className={`${M} tabular-nums`}>5 / 8회</span>
            </div>
            <div className="flex gap-1.5 mt-3 mb-2" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <i key={i} className={`flex-1 h-2.5 rounded-[3px] ${i < 5 ? 'bg-brand' : 'bg-site-line'}`} />
              ))}
            </div>
            <div className={`${M} tabular-nums`}>남은 수업 3회</div>
          </Step>
          <Step num={3} title="수업료를 받으면 기록합니다" desc="기록하는 순간 미납 목록에서 빠집니다.">
            <div className={LINE}>
              <span className={T}>11월 8회권</span>
              <StatusTag tone="paid">입금 확인</StatusTag>
            </div>
            <div className={`${M} tabular-nums`}>11월 5일, 계좌이체</div>
            <div className={`${LINE} mt-2.5`}>
              <span className={M}>받은 금액</span>
              <span className={`${T} tabular-nums`}>320,000원</span>
            </div>
          </Step>
        </ol>
      </div>
    </section>
  );
}
