import { describe, expect, it } from 'vitest';
import { countDoneSessions } from './invoice-status';

describe('countDoneSessions', () => {
  it('완료 세션만 센다 (예정은 세지 않는다)', () => {
    expect(countDoneSessions([{ isDone: true }, { isDone: true }, { isDone: true }, { isDone: false }, { isDone: false }])).toBe(3);
  });
});
