'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@heroui/react';
import clsx from 'clsx';
import { format } from 'date-fns/format';
import { ko } from 'date-fns/locale/ko';
import { tz } from '@date-fns/tz';
import type { TodaySession } from '@/utils/api/dashboard';
import { layoutTimeBar, nowPct } from '@/utils/dashboard/time-bar';
import { clockOffsetAfterRefresh, resolveTodayClock } from '@/utils/dashboard/today-clock';

interface Props {
  sessions: TodaySession[];
  unpaidStudentUuids: string[];
  timezone: string;
  // 서버가 sessions를 고른 시각(ISO). 첫 렌더를 서버·하이드레이션이 같은 시각으로 그리고, 제목 날짜의 기준이 된다
  renderedAt: string;
}

const HOURS = Array.from({ length: 25 }, (_, h) => h);
// 레인 한 줄 높이와 위아래 여백(px)
const LANE_HEIGHT = 38;
const LANE_GAP = 2;
const LANE_PADDING = 6;

export default function TodayBar({ sessions, unpaidStudentUuids, timezone, renderedAt }: Props) {
  const router = useRouter();
  const renderedDate = new Date(renderedAt);
  // 첫 렌더는 서버 시각으로 그려 하이드레이션이 어긋나지 않게 하고, 마운트 뒤 실제 시각으로 바꾼다
  const [now, setNow] = React.useState(() => new Date(renderedAt));
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // 지금 시각은 마운트 직후 한 번, 이후 1분마다 갱신
  React.useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  // 클라이언트 시계 보정값(ms). 처음엔 클라이언트 시계를 믿고, 다시 불러와 받은 서버 시각이 다른 날을 가리키면 그쪽에 맞춘다
  const [offsetMs, setOffsetMs] = React.useState(0);
  const lastRenderedAt = React.useRef(renderedAt);
  React.useEffect(() => {
    // 마운트 때 받은 renderedAt은 라우터 캐시에서 온 옛 값일 수 있어 보정 근거로 쓰지 않는다
    if (lastRenderedAt.current === renderedAt) return;
    lastRenderedAt.current = renderedAt;
    const sync = setTimeout(() => {
      const clientNow = new Date();
      setOffsetMs(clockOffsetAfterRefresh(new Date(renderedAt), clientNow, timezone));
      setNow(clientNow);
    }, 0);
    return () => clearTimeout(sync);
  }, [renderedAt, timezone]);

  // 열어 둔 채 자정을 넘기면 sessions가 어제 것이므로 새 날짜로 다시 불러온다.
  // 다시 불러오기 전까지는 서버가 그린 날 기준으로 멈춰 둬서 제목과 막대가 다른 날을 가리키지 않게 한다.
  // 서버가 아직 자정 전이라 어제를 다시 줄 수 있으니, stale인 동안은 매분 tick마다 다시 시도한다
  const { now: shownNow, stale } = resolveTodayClock(renderedDate, now, offsetMs, timezone);
  React.useEffect(() => {
    if (stale) router.refresh();
  }, [stale, now, router]);

  const currentPct = nowPct(shownNow, timezone);

  // 좁은 화면: 마운트 시 지금 시각을 가운데로
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollWidth > el.clientWidth) {
      el.scrollLeft = el.scrollWidth * currentPct / 100 - el.clientWidth / 2;
    }
    // 마운트 시 한 번만
  }, []);

  const unpaid = new Set(unpaidStudentUuids);
  const blocks = layoutTimeBar(sessions, shownNow, timezone);
  const laneCount = Math.max(1, ...blocks.map(b => b.laneCount));
  const trackHeight = LANE_PADDING * 2 + laneCount * LANE_HEIGHT + (laneCount - 1) * LANE_GAP;
  const nowHour = currentPct * 24 / 100;
  const zone = tz(timezone);

  return (
    <section className="mt-6" aria-labelledby="today-title">
      <h2 id="today-title" className="mx-0.5 mb-2.5 text-base font-semibold">
        <mark className="-ml-[3px] bg-[linear-gradient(transparent_38%,var(--color-warning)_38%_92%,transparent_92%)] px-[3px] font-bold text-inherit">
          오늘
        </mark>
        {' '}
        {format(renderedDate, 'd일 EEEE', { in: zone, locale: ko })}
        {' '}
        수업
      </h2>

      <Card className="gap-0 overflow-hidden rounded-lg border border-border p-0 shadow-none">
        <div ref={scrollRef} className="overflow-x-auto px-4 pt-3 pb-3.5 sm:px-5 [scrollbar-width:thin]">
          <div className="min-w-[880px]">
            {/* 0~24시 눈금. 지금 시각 라벨과 겹치는 눈금은 비운다 */}
            <div className="relative h-[18px] text-[11px] text-muted" aria-hidden="true">
              {HOURS.map(h => (Math.abs(h - nowHour) < 0.6
                ? null
                : (
                    <span
                      key={h}
                      className={clsx('absolute top-0 -translate-x-1/2 whitespace-nowrap', h % 6 === 0 && 'font-semibold text-foreground')}
                      style={{ left: `${h / 24 * 100}%` }}
                    >
                      {h}
                    </span>
                  )))}
            </div>

            <div
              className="relative border-y border-separator bg-[repeating-linear-gradient(90deg,var(--color-separator)_0_1px,transparent_1px_calc(100%/24))]"
              style={{ height: trackHeight }}
            >
              {blocks.map((block) => {
                const isUnpaid = unpaid.has(block.studentUuid);
                const tip = `${block.rangeLabel} ${block.name}${isUnpaid ? ', 미납 있음' : ''}${block.state === 'done' ? ', 완료' : ''}${block.state === 'absent' ? ', 결석' : ''}`;
                const laneHeight = (LANE_HEIGHT * laneCount + LANE_GAP * (laneCount - 1) - LANE_GAP * (block.laneCount - 1)) / block.laneCount;
                return (
                  <Link
                    key={block.uuid}
                    href={`/students/${block.studentUuid}`}
                    title={tip}
                    aria-label={tip}
                    className={clsx(
                      'absolute flex min-w-0 flex-col justify-center gap-px overflow-hidden rounded-[5px] px-[7px] py-1 leading-tight',
                      block.state === 'done' && 'bg-accent text-accent-foreground',
                      block.state === 'absent' && 'bg-default text-muted',
                      block.state === 'next' && 'bg-warning text-warning-foreground shadow-[inset_0_0_0_1.6px_var(--color-foreground)]',
                      block.state === 'later' && 'bg-surface text-foreground shadow-[inset_0_0_0_1.6px_var(--color-accent)] hover:bg-accent-soft',
                    )}
                    style={{
                      left: `calc(${block.leftPct}% + 2px)`,
                      width: `calc(${block.widthPct}% - 4px)`,
                      top: LANE_PADDING + block.lane * (laneHeight + LANE_GAP),
                      height: laneHeight,
                    }}
                  >
                    <b className="flex items-center gap-[5px] whitespace-nowrap text-[13px] font-semibold">
                      {block.name}
                      {isUnpaid && (
                        <i
                          aria-hidden="true"
                          className={clsx('size-1.5 shrink-0 rounded-full bg-danger', (block.state === 'done' || block.state === 'absent') && 'ring-[1.5px] ring-accent-foreground')}
                        />
                      )}
                    </b>
                    <small className={clsx('whitespace-nowrap text-[11px]', block.state === 'later' ? 'text-muted' : 'opacity-80')}>
                      {block.timeLabel}
                    </small>
                  </Link>
                );
              })}

              {blocks.length === 0 && (
                <p className="absolute inset-0 grid place-items-center text-sm text-muted">오늘 수업이 없어요</p>
              )}

              {/* 지금 시각 세로선 */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-[7px] -bottom-[7px] z-[2] border-l-2 border-foreground"
                style={{ left: `${currentPct}%` }}
              >
                <span
                  className="absolute -top-[18px] left-0 -translate-x-1/2 bg-surface px-[3px] text-[11px] font-bold"
                >
                  {format(shownNow, 'HH:mm', { in: zone })}
                </span>
              </span>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
