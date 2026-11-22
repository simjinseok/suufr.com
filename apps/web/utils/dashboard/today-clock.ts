import { isNewDay } from './month-param';

// 오늘 막대가 그릴 시각. 클라이언트 시각에 시계 보정(offsetMs)을 더해 서버 기준 지금을 만들고,
// 서버가 그린 날(renderedAt)을 넘겼으면 stale — 다시 불러오기 전까지는 서버가 그린 시각에 멈춰 둔다
export function resolveTodayClock(
  renderedAt: Date,
  clientNow: Date,
  offsetMs: number,
  timezone: string,
): { now: Date; stale: boolean } {
  const now = new Date(clientNow.getTime() + offsetMs);
  const stale = isNewDay(renderedAt, now, timezone);
  return { now: stale ? renderedAt : now, stale };
}

// 다시 불러와 새 renderedAt을 받은 직후의 시계 보정값.
// 갓 받은 서버 시각과 클라이언트가 같은 날이면 클라이언트 시계를 믿고(0),
// 다른 날이면 클라이언트 시계가 틀린 것이므로 서버 시각에 맞춘다 — 안 그러면 stale이 풀리지 않는다
export function clockOffsetAfterRefresh(renderedAt: Date, clientNow: Date, timezone: string): number {
  return isNewDay(renderedAt, clientNow, timezone) ? renderedAt.getTime() - clientNow.getTime() : 0;
}
