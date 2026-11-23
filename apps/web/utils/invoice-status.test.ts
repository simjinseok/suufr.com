import { describe, expect, it } from 'vitest';
import { countDoneSessions } from './invoice-status';

describe('countDoneSessions', () => {
  it('완료 세션만 센다 (예정은 세지 않는다)', () => {
    expect(countDoneSessions([{ status: 'done' }, { status: 'done' }, { status: 'done' }, { status: 'scheduled' }, { status: 'scheduled' }])).toBe(3);
  });

  it('결석도 끝난 수업으로 센다', () => {
    expect(countDoneSessions([{ status: 'done' }, { status: 'absent' }, { status: 'scheduled' }])).toBe(2);
  });
});
