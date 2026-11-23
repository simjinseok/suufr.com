'use client';
import * as React from 'react';
import Link from 'next/link';
import { Card } from '@heroui/react';
import clsx from 'clsx';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import type { MonthMatrix as MonthMatrixData } from '@/utils/api/dashboard';
import { formatMonthTitle, matrixCellState, matrixCellTitle, periodLinesOnDay, shiftMonth, weekdayLabel, weekdayOf } from '@/utils/dashboard/month-param';

interface Props {
  data: MonthMatrixData;
  month: string;
}

// 열 = 이름 + 1~말일. 좁은 화면은 칸을 24px로 고정하고 가로 스크롤
// 좁은 폭 기준은 뷰포트가 아니라 카드 폭(사이드바가 남아 있는 화면에서도 맞도록 컨테이너 쿼리)
const GRID_COLS = 'grid grid-cols-[160px_repeat(var(--days),minmax(0,1fr))] @max-3xl:grid-cols-[92px_repeat(var(--days),24px)]';

export default function MonthMatrix({ data, month }: Props) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const todayRef = React.useRef<HTMLDivElement>(null);

  const days = Array.from({ length: data.daysInMonth }, (_, i) => i + 1);
  const todayDay = data.today ? Number(data.today.slice(8, 10)) : null;
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  // 좁은 화면: 오늘 열이 보이도록 밀어 둔다
  React.useEffect(() => {
    const wrap = scrollRef.current;
    const td = todayRef.current;
    if (wrap && td && wrap.scrollWidth > wrap.clientWidth) {
      wrap.scrollLeft = td.offsetLeft - wrap.clientWidth / 2;
    }
  }, [month]);

  const dayClass = (day: number) => {
    const dow = weekdayOf(month, day);
    return clsx(
      'relative grid place-items-center border-l',
      // 주 경계(일요일)는 한 단계 진한 괘선
      dow === 0 ? 'border-border-secondary' : 'border-separator',
      day === todayDay ? 'bg-warning-soft' : (dow === 0 || dow === 6) && 'bg-default/40',
    );
  };

  return (
    <Card className="@container mt-6 gap-0 overflow-hidden rounded-lg border border-border p-0 shadow-none" aria-labelledby="mx-title">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 py-[13px] pr-4 pl-5">
        <div className="flex items-center gap-3">
          <h2 id="mx-title" className="whitespace-nowrap text-base font-semibold">
            {formatMonthTitle(month)}
            {' '}
            수업 현황
          </h2>
          <div className="flex gap-1">
            <MonthNavLink href={`?month=${prev}`} label={`${Number(prev.slice(5))}월 보기`}>
              <ChevronLeftIcon className="size-3.5" />
            </MonthNavLink>
            <MonthNavLink href={`?month=${next}`} label={`${Number(next.slice(5))}월 보기`}>
              <ChevronRightIcon className="size-3.5" />
            </MonthNavLink>
          </div>
        </div>
        <ul className="ml-auto hidden flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted @3xl:flex" aria-label="표식 설명">
          <li className="flex items-center gap-1.5 whitespace-nowrap">
            <Mark state="done" />
            완료
          </li>
          <li className="flex items-center gap-1.5 whitespace-nowrap">
            <Mark state="scheduled" />
            예정
          </li>
          <li className="flex items-center gap-1.5 whitespace-nowrap">
            <Mark state="absent" />
            결석
          </li>
          <li className="flex items-center gap-1.5 whitespace-nowrap">
            <i className="h-0.5 w-4 bg-accent-soft" />
            수강권 기간
          </li>
        </ul>
      </div>

      <div ref={scrollRef} className="overflow-x-auto">
        <div
          className="min-w-[1000px] @max-3xl:w-max @max-3xl:min-w-0"
          style={{ '--days': data.daysInMonth } as React.CSSProperties}
        >
          {/* 머리줄: 요일/일 */}
          <div className={clsx(GRID_COLS, 'h-[46px] border-t border-b border-t-separator border-b-border text-xs text-muted')}>
            <div className="sticky left-0 z-[3] flex items-center bg-surface pr-3 pl-5 font-medium @max-3xl:pl-3.5">수강생</div>
            {days.map((day) => {
              const dow = weekdayOf(month, day);
              const isToday = day === todayDay;
              return (
                <div
                  key={day}
                  ref={isToday ? todayRef : undefined}
                  className={clsx(dayClass(day), '!flex flex-col items-center justify-center gap-px leading-tight', isToday && '!bg-warning')}
                >
                  <span className={clsx('text-[10.5px]', isToday ? 'font-bold text-warning-foreground' : dow === 0 ? 'text-danger' : dow === 6 && 'text-accent')}>
                    {weekdayLabel(month, day)}
                  </span>
                  <span className={clsx('text-[12.5px] font-semibold tabular-nums', isToday ? 'font-bold text-warning-foreground' : 'text-foreground')}>
                    {day}
                  </span>
                </div>
              );
            })}
          </div>

          {data.rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted">수강중인 학생이 없어요</p>
          )}

          {data.rows.map(row => (
            <div key={row.student.uuid} className={clsx(GRID_COLS, 'group h-11 border-b border-separator hover:bg-surface-hover')}>
              <div className="sticky left-0 z-[3] flex flex-col justify-center bg-surface pr-2.5 pl-5 leading-snug group-hover:bg-surface-hover @max-3xl:pl-3.5">
                <b className="truncate text-sm font-semibold">{row.student.name}</b>
              </div>
              {days.map((day) => {
                const cell = row.days[day];
                return (
                  <div
                    key={day}
                    className={dayClass(day)}
                    title={cell ? matrixCellTitle(month, day, cell) : undefined}
                  >
                    {periodLinesOnDay(row.periods, day).map(line => (
                      <i
                        key={line.key}
                        className={clsx(
                          'absolute top-1/2 -mt-px h-0.5 bg-accent-soft',
                          line.isStart ? 'left-1/2' : '-left-px',
                          line.isEnd ? 'right-1/2' : 'right-0',
                        )}
                      />
                    ))}
                    {cell && cell.count > 0 && <Mark state={matrixCellState(cell)} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Mark({ state }: { state: 'scheduled' | 'done' | 'absent' }) {
  // 결석을 채운 원(bg-default)으로 그리면 너무 밝아 빈 칸처럼 보여 X로 그린다
  if (state === 'absent') {
    return <XIcon aria-hidden="true" strokeWidth={3} className="relative z-[1] block size-3 text-muted" />;
  }
  return (
    <i
      className={clsx(
        'relative z-[1] block size-3 rounded-full',
        state === 'done' ? 'bg-accent' : 'bg-surface shadow-[inset_0_0_0_1.6px_var(--color-accent)]',
      )}
    />
  );
}

function MonthNavLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="grid size-7 place-items-center rounded-md border border-border bg-surface text-muted hover:text-foreground"
    >
      {children}
    </Link>
  );
}
