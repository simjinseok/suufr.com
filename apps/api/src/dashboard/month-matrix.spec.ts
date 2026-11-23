import { buildMonthMatrix, type MonthMatrixInput } from './month-matrix';

const TZ = 'Asia/Seoul';
const NOW = new Date('2026-11-22T04:20:00Z'); // KST 2026-11-22 13:20

function input(overrides: Partial<MonthMatrixInput> = {}): MonthMatrixInput {
  return {
    year: 2026,
    month: 11,
    timezone: TZ,
    now: NOW,
    students: [{ uuid: 'a', name: '가나' }],
    sessions: [],
    invoices: [],
    ...overrides,
  };
}

/** date-only 컬럼처럼 UTC 자정으로 고정된 날짜 */
const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

describe('buildMonthMatrix', () => {
  it('세션은 유저 타임존 날짜의 칸에 들어간다', () => {
    const result = buildMonthMatrix(input({
      sessions: [
        // KST 11/30 23:30
        { studentUuid: 'a', sessionAt: new Date('2026-11-30T14:30:00Z'), isDone: false, isAbsent: false },
        // KST 11/1 00:30 (UTC로는 10/31)
        { studentUuid: 'a', sessionAt: new Date('2026-10-31T15:30:00Z'), isDone: true, isAbsent: false },
      ],
    }));

    const days = result.rows[0].days;
    expect(days[30]).toEqual({ count: 1, done: 0, absent: 0 });
    expect(days[1]).toEqual({ count: 1, done: 1, absent: 0 });
    expect(days[31]).toBeUndefined();
    expect(Object.keys(days)).toHaveLength(2);
  });

  it('그 달 밖의 세션은 넣지 않는다', () => {
    const result = buildMonthMatrix(input({
      sessions: [
        // KST 12/1 00:30 — 12월
        { studentUuid: 'a', sessionAt: new Date('2026-11-30T15:30:00Z'), isDone: false, isAbsent: false },
      ],
    }));

    expect(result.rows[0].days).toEqual({});
  });

  it('같은 날 여러 수업은 count/done으로 합친다', () => {
    const result = buildMonthMatrix(input({
      sessions: [
        { studentUuid: 'a', sessionAt: new Date('2026-11-10T01:00:00Z'), isDone: true, isAbsent: false },
        { studentUuid: 'a', sessionAt: new Date('2026-11-10T05:00:00Z'), isDone: false, isAbsent: false },
      ],
    }));

    expect(result.rows[0].days[10]).toEqual({ count: 2, done: 1, absent: 0 });
  });

  it('결석은 done과 absent에 모두 센다', () => {
    const result = buildMonthMatrix(input({
      sessions: [
        { studentUuid: 'a', sessionAt: new Date('2026-11-10T01:00:00Z'), isDone: true, isAbsent: true },
        { studentUuid: 'a', sessionAt: new Date('2026-11-10T05:00:00Z'), isDone: true, isAbsent: false },
      ],
    }));

    expect(result.rows[0].days[10]).toEqual({ count: 2, done: 2, absent: 1 });
  });

  it('수강권 기간은 그 달로 잘라 0과 daysInMonth+1로 경계를 표시한다', () => {
    const result = buildMonthMatrix(input({
      invoices: [
        { studentUuid: 'a', periodStart: d(2026, 10, 20), periodEnd: d(2026, 11, 16) },
        { studentUuid: 'a', periodStart: d(2026, 11, 19), periodEnd: null },
        { studentUuid: 'a', periodStart: d(2026, 11, 3), periodEnd: d(2026, 11, 27) },
        { studentUuid: 'a', periodStart: d(2026, 11, 5), periodEnd: d(2026, 12, 10) },
      ],
    }));

    expect(result.rows[0].periods).toEqual([
      { startDay: 0, endDay: 16 },
      { startDay: 19, endDay: 31 },
      { startDay: 3, endDay: 27 },
      { startDay: 5, endDay: 31 },
    ]);
  });

  it('그 달과 겹치지 않는 수강권은 버린다', () => {
    const result = buildMonthMatrix(input({
      invoices: [
        { studentUuid: 'a', periodStart: d(2026, 9, 1), periodEnd: d(2026, 10, 31) },
        { studentUuid: 'a', periodStart: d(2026, 12, 1), periodEnd: null },
      ],
    }));

    expect(result.rows[0].periods).toEqual([]);
  });

  it('daysInMonth는 달 길이를 따른다', () => {
    expect(buildMonthMatrix(input({ year: 2026, month: 2 })).daysInMonth).toBe(28);
    expect(buildMonthMatrix(input({ year: 2028, month: 2 })).daysInMonth).toBe(29);
    expect(buildMonthMatrix(input({ year: 2026, month: 12 })).daysInMonth).toBe(31);
    expect(buildMonthMatrix(input({ year: 2026, month: 11 })).daysInMonth).toBe(30);
  });

  it('month는 YYYY-MM 형식이다', () => {
    expect(buildMonthMatrix(input({ year: 2026, month: 2 })).month).toBe('2026-02');
    expect(buildMonthMatrix(input({ year: 2026, month: 11 })).month).toBe('2026-11');
  });

  it('today는 그 달 안일 때만 채운다', () => {
    expect(buildMonthMatrix(input({ month: 11 })).today).toBe('2026-11-22');
    expect(buildMonthMatrix(input({ month: 10 })).today).toBeNull();
  });

  it('today는 유저 타임존 날짜를 따른다', () => {
    // UTC 11/30 15:30 = KST 12/1 00:30
    const now = new Date('2026-11-30T15:30:00Z');
    expect(buildMonthMatrix(input({ now, month: 11 })).today).toBeNull();
    expect(buildMonthMatrix(input({ now, month: 12 })).today).toBe('2026-12-01');
  });

  it('행은 이름순, 수업 없는 학생도 행을 가진다', () => {
    const result = buildMonthMatrix(input({
      students: [
        { uuid: 'c', name: '하늘' },
        { uuid: 'a', name: '가람' },
        { uuid: 'b', name: '나래' },
      ],
      sessions: [
        { studentUuid: 'b', sessionAt: new Date('2026-11-10T01:00:00Z'), isDone: false, isAbsent: false },
      ],
    }));

    expect(result.rows.map(r => r.student)).toEqual([
      { uuid: 'a', name: '가람' },
      { uuid: 'b', name: '나래' },
      { uuid: 'c', name: '하늘' },
    ]);
    expect(result.rows[0].days).toEqual({});
    expect(result.rows[0].periods).toEqual([]);
    expect(result.rows[1].days[10]).toEqual({ count: 1, done: 0, absent: 0 });
  });

  it('대상 학생 목록에 없는 학생의 세션·수강권은 무시한다', () => {
    const result = buildMonthMatrix(input({
      sessions: [{ studentUuid: 'x', sessionAt: new Date('2026-11-10T01:00:00Z'), isDone: false, isAbsent: false }],
      invoices: [{ studentUuid: 'x', periodStart: d(2026, 11, 1), periodEnd: null }],
    }));

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].days).toEqual({});
    expect(result.rows[0].periods).toEqual([]);
  });
});
