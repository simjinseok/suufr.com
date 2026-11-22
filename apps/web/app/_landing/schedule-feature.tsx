import { H2, StatusTag, WRAP } from './product-ui';

const SESSIONS = [
  { date: '11.12 수', time: '17:00', done: true },
  { date: '11.17 월', time: '17:00', done: true },
  { date: '11.19 수', time: '17:00', done: false },
  { date: '11.24 월', time: '17:00', done: false },
];

export default function ScheduleFeature() {
  return (
    <section className="bg-site-band py-16 md:py-24">
      <div className={`${WRAP} grid grid-cols-[minmax(0,1fr)] gap-9 items-center md:grid-cols-2 md:gap-16`}>
        <div>
          <h2 className={H2}>한 달 수업 일정을 한 번에 잡습니다</h2>
          <p className="mt-4 max-w-[28em]">요일과 시간을 정하면 수강권의 수업이 한꺼번에 만들어집니다. 수업이 끝나면 완료만 누르면 됩니다.</p>
          <p className="mt-4 max-w-[28em]">정규 수업과 체험 수업, 무료로 해 준 수업은 따로 구분해 둘 수 있습니다.</p>
        </div>
        <div
          aria-label="수업 일정 화면 예시"
          className="min-w-0 bg-white border border-site-line rounded-[14px] overflow-hidden text-[15px] leading-[1.45]"
        >
          <div className="flex items-baseline justify-between px-5 pt-4 pb-[13px] border-b border-site-line">
            <b className="text-[17px] font-bold text-brand-navy">김서연</b>
            <span className="text-[14px] text-site-muted">11월 8회권</span>
          </div>
          <div className="bg-brand-soft text-brand-soft-text text-[14px] font-semibold px-5 py-2.5">
            매주 월·수 17:00, 수업 8회를 만들었습니다
          </div>
          {SESSIONS.map((session) => (
            <div
              key={session.date}
              className="grid grid-cols-[78px_1fr_auto] md:grid-cols-[92px_1fr_auto] gap-3 items-center px-5 py-3 border-b border-site-line last:border-b-0"
            >
              <span className="text-site-muted text-[14px] tabular-nums">{session.date}</span>
              <span className="font-semibold text-brand-navy tabular-nums">{session.time}</span>
              <StatusTag tone={session.done ? 'paid' : 'plain'}>{session.done ? '완료' : '예정'}</StatusTag>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
