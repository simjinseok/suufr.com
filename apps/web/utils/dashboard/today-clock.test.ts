import { describe, expect, it } from 'vitest';
import { clockOffsetAfterRefresh, resolveTodayClock } from './today-clock';

const SEOUL = 'Asia/Seoul';
const MINUTE = 60_000;

describe('resolveTodayClock', () => {
  it('보정이 없으면 클라이언트 시각을 그대로 쓴다', () => {
    // KST 11/22 13:00 렌더, 13:20 지금
    const clock = resolveTodayClock(new Date('2026-11-22T04:00:00Z'), new Date('2026-11-22T04:20:00Z'), 0, SEOUL);
    expect(clock).toEqual({ now: new Date('2026-11-22T04:20:00Z'), stale: false });
  });

  it('서버가 그린 날을 넘기면 stale이고 서버가 그린 시각에 멈춘다', () => {
    // KST 11/22 23:50 렌더, 11/23 00:05 지금
    const renderedAt = new Date('2026-11-22T14:50:00Z');
    const clock = resolveTodayClock(renderedAt, new Date('2026-11-22T15:05:00Z'), 0, SEOUL);
    expect(clock).toEqual({ now: renderedAt, stale: true });
  });

  it('시계 보정을 더한 시각으로 날짜를 판단한다', () => {
    // 클라이언트가 1분 빠름: 클라이언트 00:00:30, 서버 23:59:30
    const renderedAt = new Date('2026-11-22T14:59:30Z');
    const clock = resolveTodayClock(renderedAt, new Date('2026-11-22T15:00:30Z'), -MINUTE, SEOUL);
    expect(clock).toEqual({ now: new Date('2026-11-22T14:59:30Z'), stale: false });
  });

  it('보정해도 서버 시각이 자정을 넘기면 다시 stale', () => {
    const renderedAt = new Date('2026-11-22T14:59:30Z');
    // 클라이언트 00:01:10 → 서버 00:00:10
    const clock = resolveTodayClock(renderedAt, new Date('2026-11-22T15:01:10Z'), -MINUTE, SEOUL);
    expect(clock.stale).toBe(true);
  });
});

describe('clockOffsetAfterRefresh', () => {
  it('새로 받은 렌더 시각과 클라이언트가 같은 날이면 보정하지 않는다', () => {
    // 몇 초 차이는 무시한다
    expect(clockOffsetAfterRefresh(new Date('2026-11-22T15:00:01Z'), new Date('2026-11-22T15:00:05Z'), SEOUL)).toBe(0);
  });

  it('클라이언트 시계가 빨라 자정 직전에 다시 불러오면 서버 시각에 맞춘다', () => {
    // 클라이언트 00:00:30에 새로고침했는데 서버는 아직 23:59:30
    const renderedAt = new Date('2026-11-22T14:59:30Z');
    const clientNow = new Date('2026-11-22T15:00:30Z');
    const offset = clockOffsetAfterRefresh(renderedAt, clientNow, SEOUL);
    expect(offset).toBe(-MINUTE);
    // 보정한 뒤에는 stale이 풀려 지금선이 서버 시각으로 움직인다(서버 23:59:50)
    const before = new Date(clientNow.getTime() + 20_000);
    expect(resolveTodayClock(renderedAt, before, offset, SEOUL)).toEqual({
      now: new Date('2026-11-22T14:59:50Z'),
      stale: false,
    });
    // 서버 시각이 실제로 자정을 넘기면 다시 stale이 되어 새로고침할 수 있다
    const after = new Date(clientNow.getTime() + MINUTE / 2);
    expect(resolveTodayClock(renderedAt, after, offset, SEOUL).stale).toBe(true);
  });

  it('클라이언트 시계가 하루 넘게 틀려도 서버 시각 기준으로 지금선이 움직인다', () => {
    // 클라이언트가 이틀 빠름
    const renderedAt = new Date('2026-11-22T04:00:00Z');
    const clientNow = new Date('2026-11-24T04:00:00Z');
    const offset = clockOffsetAfterRefresh(renderedAt, clientNow, SEOUL);
    const clock = resolveTodayClock(renderedAt, new Date(clientNow.getTime() + 20 * MINUTE), offset, SEOUL);
    expect(clock).toEqual({ now: new Date('2026-11-22T04:20:00Z'), stale: false });
  });
});
