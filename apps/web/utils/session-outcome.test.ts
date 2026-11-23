import { describe, expect, it } from 'vitest';
import { getSessionOutcome, outcomeToFlags, type SessionOutcome } from './session-outcome';

describe('getSessionOutcome', () => {
  it('완료 아님은 예정', () => {
    expect(getSessionOutcome({ isDone: false, isAbsent: false })).toBe('scheduled');
  });

  it('완료이고 결석 아님은 완료', () => {
    expect(getSessionOutcome({ isDone: true, isAbsent: false })).toBe('done');
  });

  it('완료이고 결석이면 결석', () => {
    expect(getSessionOutcome({ isDone: true, isAbsent: true })).toBe('absent');
  });
});

describe('outcomeToFlags', () => {
  it('예정은 두 플래그 모두 끈다', () => {
    expect(outcomeToFlags('scheduled')).toStrictEqual({ isDone: false, isAbsent: false });
  });

  it('완료는 결석을 끈다', () => {
    expect(outcomeToFlags('done')).toStrictEqual({ isDone: true, isAbsent: false });
  });

  it('결석은 두 플래그 모두 켠다', () => {
    expect(outcomeToFlags('absent')).toStrictEqual({ isDone: true, isAbsent: true });
  });

  it('플래그로 바꿨다 되돌리면 같은 상태다', () => {
    const outcomes: SessionOutcome[] = ['scheduled', 'done', 'absent'];
    for (const o of outcomes) {
      expect(getSessionOutcome(outcomeToFlags(o))).toBe(o);
    }
  });
});
