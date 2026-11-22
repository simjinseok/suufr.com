import { describe, expect, it } from 'vitest';
import { elapsedLabel, sumPrice } from './unpaid';

describe('elapsedLabel', () => {
  it('시작일을 1일째로 센다', () => {
    expect(elapsedLabel('2026-11-22T00:00:00.000Z', '2026-11-22')).toBe('1일째');
    expect(elapsedLabel('2026-11-08T00:00:00.000Z', '2026-11-22')).toBe('15일째');
  });

  it('달을 넘겨도 날짜 차이로 센다', () => {
    expect(elapsedLabel('2026-10-31T00:00:00.000Z', '2026-11-02')).toBe('3일째');
  });

  it('시작 전이면 시작 전', () => {
    expect(elapsedLabel('2026-11-23T00:00:00.000Z', '2026-11-22')).toBe('시작 전');
  });
});

describe('sumPrice', () => {
  it('금액 합계', () => {
    expect(sumPrice([{ price: 260000 }, { price: 400000 }])).toBe(660000);
    expect(sumPrice([])).toBe(0);
  });
});
