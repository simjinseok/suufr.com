import { describe, expect, it } from 'vitest';
import { formatMonthTitle, isNewDay, matrixCellState, matrixCellTitle, parseMonthParam, periodLinesOnDay, shiftMonth, todayString, weekdayOf } from './month-param';

const SEOUL = 'Asia/Seoul';
// KST 2026-11-22 13:20
const NOW = new Date('2026-11-22T04:20:00Z');

describe('parseMonthParam', () => {
  it('유효한 YYYY-MM이면 그대로 쓴다', () => {
    expect(parseMonthParam('2026-10', SEOUL, NOW)).toBe('2026-10');
  });

  it('잘못된 값이나 없는 값이면 그 타임존의 이번 달', () => {
    expect(parseMonthParam('2026-13', SEOUL, NOW)).toBe('2026-11');
    expect(parseMonthParam('abc', SEOUL, NOW)).toBe('2026-11');
    expect(parseMonthParam(undefined, SEOUL, NOW)).toBe('2026-11');
  });

  it('이번 달은 유저 타임존 기준이다', () => {
    // UTC 11-30 15:30 = KST 12-01 00:30
    const edge = new Date('2026-11-30T15:30:00Z');
    expect(parseMonthParam(undefined, SEOUL, edge)).toBe('2026-12');
    expect(parseMonthParam(undefined, 'UTC', edge)).toBe('2026-11');
  });
});

describe('shiftMonth', () => {
  it('해를 넘긴다', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('같은 해 안에서 앞뒤로 움직인다', () => {
    expect(shiftMonth('2026-11', -1)).toBe('2026-10');
    expect(shiftMonth('2026-09', 1)).toBe('2026-10');
  });
});

describe('formatMonthTitle', () => {
  it('YYYY년 M월', () => {
    expect(formatMonthTitle('2026-11')).toBe('2026년 11월');
    expect(formatMonthTitle('2027-01')).toBe('2027년 1월');
  });
});

describe('todayString', () => {
  it('유저 타임존의 오늘 날짜', () => {
    expect(todayString(SEOUL, new Date('2026-11-30T15:30:00Z'))).toBe('2026-12-01');
    expect(todayString('UTC', new Date('2026-11-30T15:30:00Z'))).toBe('2026-11-30');
  });
});

describe('weekdayOf', () => {
  it('그 달 그 날의 요일(0=일)', () => {
    // 2026-11-01은 일요일
    expect(weekdayOf('2026-11', 1)).toBe(0);
    expect(weekdayOf('2026-11', 7)).toBe(6);
    expect(weekdayOf('2026-11', 22)).toBe(0);
  });
});

describe('matrixCellTitle', () => {
  it('모두 완료면 수업 완료, 아니면 수업 예정', () => {
    expect(matrixCellTitle('2026-11', 3, { count: 1, done: 1, absent: 0 })).toBe('11월 3일 (화) 수업 완료');
    expect(matrixCellTitle('2026-11', 25, { count: 1, done: 0, absent: 0 })).toBe('11월 25일 (수) 수업 예정');
  });

  it('하루 1건이 결석이면 수업 결석', () => {
    expect(matrixCellTitle('2026-11', 10, { count: 1, done: 1, absent: 1 })).toBe('11월 10일 (화) 수업 결석');
    expect(matrixCellTitle('2026-11', 10, { count: 1, done: 1, absent: 0 })).toBe('11월 10일 (화) 수업 완료');
  });

  it('하루 여러 회면 횟수를 쓴다', () => {
    expect(matrixCellTitle('2026-11', 22, { count: 2, done: 1, absent: 0 })).toBe('11월 22일 (일) 수업 2회');
  });
});

describe('matrixCellState', () => {
  it('예정이 남았으면 예정, 다 끝났고 결석이 있으면 결석, 아니면 완료', () => {
    expect(matrixCellState({ count: 2, done: 1, absent: 1 })).toBe('scheduled');
    expect(matrixCellState({ count: 2, done: 2, absent: 1 })).toBe('absent');
    expect(matrixCellState({ count: 2, done: 2, absent: 0 })).toBe('done');
  });
});

describe('periodLinesOnDay', () => {
  it('그날에 걸친 기간만 고르고 시작·끝 반 칸을 표시한다', () => {
    const lines = periodLinesOnDay([{ startDay: 3, endDay: 27 }, { startDay: 28, endDay: 31 }], 3);
    expect(lines).toEqual([{ key: 0, isStart: true, isEnd: false }]);
  });

  it('잘린 뒤 기간이 같은 수강권도 key가 겹치지 않는다', () => {
    // 9/1~무기한, 10/1~12/31 둘 다 11월 표에서는 {0, 31}
    const lines = periodLinesOnDay([{ startDay: 0, endDay: 31 }, { startDay: 0, endDay: 31 }], 15);
    expect(lines).toHaveLength(2);
    expect(new Set(lines.map(l => l.key)).size).toBe(2);
  });
});

describe('isNewDay', () => {
  it('서버가 그린 날과 지금이 유저 타임존에서 같은 날이면 false', () => {
    // KST 11/22 00:00 렌더, 23:59 지금
    expect(isNewDay(new Date('2026-11-21T15:00:00Z'), new Date('2026-11-22T14:59:00Z'), SEOUL)).toBe(false);
  });

  it('유저 타임존 자정을 넘기면 true', () => {
    // KST 11/22 23:50 렌더, 11/23 00:05 지금
    expect(isNewDay(new Date('2026-11-22T14:50:00Z'), new Date('2026-11-22T15:05:00Z'), SEOUL)).toBe(true);
    expect(isNewDay(new Date('2026-11-22T14:50:00Z'), new Date('2026-11-22T15:05:00Z'), 'UTC')).toBe(false);
  });
});
