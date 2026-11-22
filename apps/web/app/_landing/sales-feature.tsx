import { H2, PANEL, PANEL_HEAD, WRAP } from './product-ui';

const MONTHS = [
  { month: '8월', width: 'w-[78%]', amount: '1,240,000원', current: false },
  { month: '9월', width: 'w-[90%]', amount: '1,420,000원', current: false },
  { month: '10월', width: 'w-[87%]', amount: '1,380,000원', current: false },
  { month: '11월', width: 'w-[54%]', amount: '860,000원', current: true },
];

export default function SalesFeature() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className={`${WRAP} grid grid-cols-[minmax(0,1fr)] gap-9 items-center md:grid-cols-2 md:gap-16`}>
        <div className="md:order-2">
          <h2 className={H2}>이번 달에 얼마를 받았는지 바로 압니다</h2>
          <p className="mt-4 max-w-[28em]">받은 수업료가 월별, 연도별로 모입니다. 통장 내역을 하나씩 더해 볼 필요가 없습니다.</p>
        </div>
        <div
          role="figure"
          aria-label="입금 내역 화면 예시"
          className={PANEL}
        >
          <div className={PANEL_HEAD}>
            <b className="text-[17px] font-bold text-brand-navy">받은 수업료</b>
            <div className="flex gap-1">
              <span className="text-[13.5px] px-2.5 py-[3px] rounded-md bg-site-band text-brand-navy font-semibold">월별</span>
              <span className="text-[13.5px] px-2.5 py-[3px] rounded-md text-site-muted">연도별</span>
            </div>
          </div>
          <div className="px-5 pt-3.5 pb-[18px]">
            {MONTHS.map((row) => (
              <div key={row.month} className="grid grid-cols-[44px_1fr_96px] gap-3 items-center py-[7px] text-[14px]">
                <span className="text-site-muted">{row.month}</span>
                <span className="block h-3.5 bg-site-band rounded-[3px] overflow-hidden">
                  <span className={`block h-full rounded-[3px] ${row.width} ${row.current ? 'bg-brand-sky' : 'bg-brand'}`} />
                </span>
                <span className="text-right font-semibold text-brand-navy tabular-nums">{row.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
