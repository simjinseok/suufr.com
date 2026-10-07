import { describe, expect, it } from 'vitest';
import { formatInvoicePeriod, getCountProgress, getPeriodProgress } from './invoice-period';

describe('formatInvoicePeriod', () => {
  it('같은 해면 종료 쪽 연도를 생략한다', () => {
    expect(formatInvoicePeriod('2026-10-01T00:00:00.000Z', '2026-10-31T00:00:00.000Z')).toBe('2026.10.1 ~ 10.31');
  });

  it('해가 바뀌면 종료 연도를 쓴다', () => {
    expect(formatInvoicePeriod('2026-12-15T00:00:00.000Z', '2027-01-14T00:00:00.000Z')).toBe('2026.12.15 ~ 2027.1.14');
  });

  it('한쪽이라도 없으면 null (서버가 둘 다 또는 둘 다 없음만 허용)', () => {
    expect(formatInvoicePeriod(null, null)).toBeNull();
    expect(formatInvoicePeriod('2026-10-01T00:00:00.000Z', null)).toBeNull();
  });
});

describe('getPeriodProgress', () => {
  const start = '2026-10-01T00:00:00.000Z';
  const end = '2026-10-31T00:00:00.000Z';

  it('기간 중간: 남은 일수와 경과 비율', () => {
    // 10/1~10/31 = 31일, 오늘 10/10 → 경과 10일, 남은 21일
    expect(getPeriodProgress(start, end, '2026-10-10')).toEqual({ daysLeft: 21, ratio: 10 / 31 });
  });

  it('종료일 당일: daysLeft 0, 비율 1', () => {
    expect(getPeriodProgress(start, end, '2026-10-31')).toEqual({ daysLeft: 0, ratio: 1 });
  });

  it('이미 끝난 기간: daysLeft 음수, 비율은 1에서 멈춘다', () => {
    expect(getPeriodProgress(start, end, '2026-11-05')).toEqual({ daysLeft: -5, ratio: 1 });
  });

  it('아직 시작 전: 비율 0', () => {
    expect(getPeriodProgress(start, end, '2026-09-20')).toEqual({ daysLeft: 41, ratio: 0 });
  });

  it('하루짜리 기간: 당일 비율 1', () => {
    expect(getPeriodProgress(start, start, '2026-10-01')).toEqual({ daysLeft: 0, ratio: 1 });
  });

  it('기간이 없으면 null', () => {
    expect(getPeriodProgress(null, null, '2026-10-10')).toBeNull();
    expect(getPeriodProgress(start, null, '2026-10-10')).toBeNull();
  });
});

describe('getCountProgress', () => {
  it('일반: 남은 횟수와 완료 비율', () => {
    expect(getCountProgress(8, 3)).toEqual({ remaining: 5, ratio: 3 / 8 });
  });

  it('전체 횟수 0이면 비율 0 (0으로 나누지 않는다)', () => {
    expect(getCountProgress(0, 0)).toEqual({ remaining: 0, ratio: 0 });
  });

  it('완료가 전체를 넘으면 남은 0, 비율 1', () => {
    expect(getCountProgress(4, 6)).toEqual({ remaining: 0, ratio: 1 });
  });
});
