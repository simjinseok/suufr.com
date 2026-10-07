import { describe, expect, it } from 'vitest';
import { getRemainingCount } from './invoice-status';

describe('getRemainingCount', () => {
  it('완료 세션만 차감한다 (예정은 차감 안 함)', () => {
    expect(getRemainingCount({
      totalCount: 8,
      sessions: [{ isDone: true }, { isDone: true }, { isDone: true }, { isDone: false }, { isDone: false }],
    })).toBe(5);
  });

  it('완료가 전체를 넘어도 0 아래로 내려가지 않는다', () => {
    expect(getRemainingCount({ totalCount: 2, sessions: [{ isDone: true }, { isDone: true }, { isDone: true }] })).toBe(0);
  });

  it('기간권(totalCount 없음)은 null', () => {
    expect(getRemainingCount({ totalCount: null, sessions: [{ isDone: true }] })).toBeNull();
  });
});
