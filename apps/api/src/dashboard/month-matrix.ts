import { zonedParts } from '../common/utils/timezone';

/** 메인 월 매트릭스 응답. 웹 메인(`/dashboard`)의 "YYYY년 M월 수업 현황" 표가 그린다. */
export type MonthMatrix = {
  /** 'YYYY-MM' */
  month: string;
  /** 28~31 */
  daysInMonth: number;
  /** 그 달에 오늘(유저 타임존)이 있으면 'YYYY-MM-DD', 아니면 null */
  today: string | null;
  /** 이름 오름차순 */
  rows: MatrixRow[];
};

export type MatrixRow = {
  student: { uuid: string; name: string };
  /** 키 = 일(1..daysInMonth). 수업이 있는 날만 들어간다. 결석은 수업한 것이라 done에도 센다 */
  days: Record<number, { count: number; done: number; absent: number }>;
  /** 0 = 지난달부터 이어짐, daysInMonth+1 = 다음 달까지 이어짐(무기한 포함) */
  periods: { startDay: number; endDay: number }[];
};

export type MonthMatrixInput = {
  year: number;
  /** 1~12 */
  month: number;
  timezone: string;
  now: Date;
  students: { uuid: string; name: string }[];
  sessions: { studentUuid: string; sessionAt: Date; isDone: boolean; isAbsent: boolean }[];
  invoices: { studentUuid: string; periodStart: Date; periodEnd: Date | null }[];
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** date-only 컬럼(UTC 자정 고정)을 비교용 정수 YYYYMMDD로 */
const utcDateKey = (date: Date) =>
  date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();

/**
 * 학생·세션·수강권을 한 달짜리 매트릭스로 접는다.
 * 세션 날짜는 유저 타임존 벽시계 기준, 수강권 기간은 date-only 그대로(UTC 연월일) 비교한다.
 */
export function buildMonthMatrix(input: MonthMatrixInput): MonthMatrix {
  const { year, month, timezone, now } = input;
  // Date.UTC의 일 0 = 전달 말일 → 이번 달 길이
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const todayParts = zonedParts(now, timezone);
  const today = todayParts.year === year && todayParts.month === month
    ? `${year}-${pad2(month)}-${pad2(todayParts.day)}`
    : null;

  const rowsByUuid = new Map<string, MatrixRow>();
  for (const student of input.students) {
    rowsByUuid.set(student.uuid, {
      student: { uuid: student.uuid, name: student.name },
      days: {},
      periods: [],
    });
  }

  for (const session of input.sessions) {
    const row = rowsByUuid.get(session.studentUuid);
    if (!row) continue;
    const parts = zonedParts(session.sessionAt, timezone);
    if (parts.year !== year || parts.month !== month) continue;
    const cell = row.days[parts.day] ?? { count: 0, done: 0, absent: 0 };
    cell.count += 1;
    if (session.isDone) cell.done += 1;
    if (session.isAbsent) cell.absent += 1;
    row.days[parts.day] = cell;
  }

  const monthFirst = year * 10000 + month * 100 + 1;
  const monthLast = year * 10000 + month * 100 + daysInMonth;
  for (const invoice of input.invoices) {
    const row = rowsByUuid.get(invoice.studentUuid);
    if (!row) continue;
    const start = utcDateKey(invoice.periodStart);
    const end = invoice.periodEnd ? utcDateKey(invoice.periodEnd) : null;
    // 그 달과 겹치지 않으면 버린다
    if (start > monthLast || (end !== null && end < monthFirst)) continue;
    row.periods.push({
      startDay: start < monthFirst ? 0 : start % 100,
      endDay: end === null || end > monthLast ? daysInMonth + 1 : end % 100,
    });
  }

  const rows = [...rowsByUuid.values()].sort((a, b) =>
    a.student.name.localeCompare(b.student.name, 'ko'),
  );

  return {
    month: `${year}-${pad2(month)}`,
    daysInMonth,
    today,
    rows,
  };
}
