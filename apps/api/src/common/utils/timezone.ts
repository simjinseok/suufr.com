/**
 * IANA 타임존 기준 벽시계 경계 계산.
 *
 * Intl의 타임존 데이터를 사용해 DST가 있는 타임존에서도 올바른 경계를 계산한다.
 * 타임존은 명시 timezone 파라미터 > UserSettings.timezone > UTC 순으로 해석된다
 * (SettingsService.resolveTimezone). payments/dashboard 경계 계산과
 * sessions의 날짜 기반 자동 귀속이 사용한다.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** 해당 순간의 벽시계를 UTC 눈금 위의 밀리초로 환산한 값. */
function wallClockAsUTC(instant: Date, timeZone: string): number {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(p => p.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

/**
 * 해당 타임존의 벽시계 연/월/일. (toKstParts 대응)
 */
export function zonedParts(instant: Date, timeZone: string): { year: number; month: number; day: number } {
  const wall = new Date(wallClockAsUTC(instant, timeZone));
  return {
    year: wall.getUTCFullYear(),
    month: wall.getUTCMonth() + 1,
    day: wall.getUTCDate(),
  };
}

/**
 * 해당 타임존에서 주어진 날짜가 시작되는 UTC 순간. (kstDayStart 대응)
 * @param month 벗어난 값은 달력에 맞게 롤오버(월 13 → 이듬해 1월 등) — 구간 계산용.
 * @param day   벗어난 값은 달력에 맞게 롤오버(일 32 → 다음 달) — 구간 계산용.
 *
 * DST로 그 날 자정이 존재하지 않으면(시계가 00:00을 건너뜀) 그 날의 실제 첫 순간을 반환.
 */
export function zonedDayStart(year: number, month: number, day: number, timeZone: string): Date {
  // Date.UTC이 롤오버를 정규화한 "목표 벽시계(그 날 00:00)"를 UTC 눈금 숫자로.
  const desired = Date.UTC(year, month - 1, day);
  const offsetAt = (ts: number) => wallClockAsUTC(new Date(ts), timeZone) - ts;

  // 고정점 반복 2회 — 오프셋이 목표 부근에서 일정하면 1회에 수렴한다.
  const first = desired - offsetAt(desired);
  const second = desired - offsetAt(first);

  // 정확히 목표 벽시계에 떨어지는 후보가 있으면 이른 순간을 선택(중복 시각은 첫 발생).
  const exact = [first, second]
    .filter(ts => wallClockAsUTC(new Date(ts), timeZone) === desired)
    .sort((a, b) => a - b);
  if (exact.length > 0) return new Date(exact[0]);

  // 자정이 존재하지 않는 날(DST 공백) — 목표 이후 벽시계로 넘어간 후보가 그 날의 첫 순간.
  const afterGap = [first, second].find(ts => wallClockAsUTC(new Date(ts), timeZone) > desired);
  return new Date(afterGap ?? second);
}

/**
 * 해당 타임존에서 주어진 월이 시작되는 UTC 순간. (kstMonthStart 대응, 월 롤오버 지원)
 */
export function zonedMonthStart(year: number, month: number, timeZone: string): Date {
  return zonedDayStart(year, month, 1, timeZone);
}
