import { TZDate } from '@date-fns/tz';

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function splitMonth(month: string) {
  const [year, mon] = month.split('-').map(Number);
  return { year, mon };
}

// 유저 타임존의 오늘 'YYYY-MM-DD'
export function todayString(timezone: string, now: Date = new Date()): string {
  const zoned = new TZDate(now, timezone);
  return `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}`;
}

// ?month= 정규화 — 유효한 'YYYY-MM'이면 그대로, 아니면 그 타임존의 이번 달
export function parseMonthParam(raw: string | undefined, timezone: string, now: Date = new Date()): string {
  if (raw && MONTH_RE.test(raw)) return raw;
  return todayString(timezone, now).slice(0, 7);
}

export function shiftMonth(month: string, delta: -1 | 1): string {
  const { year, mon } = splitMonth(month);
  const index = year * 12 + (mon - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

export function formatMonthTitle(month: string): string {
  const { year, mon } = splitMonth(month);
  return `${year}년 ${mon}월`;
}

// 그 달 그 날의 요일 (0=일). 달력 날짜라 타임존과 무관하게 UTC로 계산한다
export function weekdayOf(month: string, day: number): number {
  const { year, mon } = splitMonth(month);
  return new Date(Date.UTC(year, mon - 1, day)).getUTCDay();
}

export function weekdayLabel(month: string, day: number): string {
  return WEEKDAYS[weekdayOf(month, day)];
}

// 월 매트릭스 한 칸. done은 결석을 포함한다
export type MatrixCell = { count: number; done: number; absent: number };

const CELL_STATE_TITLE = { scheduled: '수업 예정', done: '수업 완료', absent: '수업 결석' } as const;

// 예정이 하나라도 남았으면 예정, 다 끝났고 결석이 섞였으면 결석
export function matrixCellState(cell: MatrixCell): 'scheduled' | 'done' | 'absent' {
  if (cell.done < cell.count) return 'scheduled';
  return cell.absent > 0 ? 'absent' : 'done';
}

// 매트릭스 칸 툴팁 — 'M월 D일 (요일) 수업 완료/예정/결석', 하루 여러 회면 '수업 N회'
export function matrixCellTitle(month: string, day: number, cell: MatrixCell): string {
  const { mon } = splitMonth(month);
  const what = cell.count > 1
    ? `수업 ${cell.count}회`
    : CELL_STATE_TITLE[matrixCellState(cell)];
  return `${mon}월 ${day}일 (${weekdayLabel(month, day)}) ${what}`;
}

// 그날 칸에 그릴 수강권 기간 선. key는 원래 순서라 잘린 기간이 같은 수강권끼리도 겹치지 않는다
export function periodLinesOnDay(
  periods: { startDay: number; endDay: number }[],
  day: number,
): { key: number; isStart: boolean; isEnd: boolean }[] {
  return periods.flatMap((p, index) => (day >= p.startDay && day <= p.endDay
    ? [{ key: index, isStart: day === p.startDay, isEnd: day === p.endDay }]
    : []));
}

// 서버가 그린 시각(renderedAt)과 지금이 유저 타임존에서 다른 날인지 — 자정을 넘기면 다시 불러온다
export function isNewDay(renderedAt: Date, now: Date, timezone: string): boolean {
  return todayString(timezone, renderedAt) !== todayString(timezone, now);
}
