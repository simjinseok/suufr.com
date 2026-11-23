import { describe, expect, it } from 'vitest';
import { isFinished, SESSION_STATUS_LABEL, SESSION_STATUSES } from './session-status';

describe('SESSION_STATUS_LABEL', () => {
  it('예정·완료·결석 라벨', () => {
    expect(SESSION_STATUS_LABEL.scheduled).toBe('예정');
    expect(SESSION_STATUS_LABEL.done).toBe('완료');
    expect(SESSION_STATUS_LABEL.absent).toBe('결석');
  });

  it('상태 목록 순서는 예정·완료·결석', () => {
    expect(SESSION_STATUSES).toStrictEqual(['scheduled', 'done', 'absent']);
  });
});

describe('isFinished', () => {
  it('예정은 끝나지 않은 수업', () => {
    expect(isFinished('scheduled')).toBe(false);
  });

  it('완료는 끝난 수업', () => {
    expect(isFinished('done')).toBe(true);
  });

  it('결석도 끝난 수업', () => {
    expect(isFinished('absent')).toBe(true);
  });
});
