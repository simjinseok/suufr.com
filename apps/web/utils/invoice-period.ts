// 수강권 카드의 기간·회차 파생 계산 (docs/schema-redesign.md §3)
// periodStart/periodEnd 는 @db.Date → "YYYY-MM-DDT00:00:00.000Z". 타임존 변환 없이 앞 10자만 쓴다.
// "오늘"(today)은 서버가 유저 타임존으로 만든 "YYYY-MM-DD" 문자열 — 클라이언트에서 new Date() 를 쓰지 않는다.

const MS_PER_DAY = 86_400_000;

function parseYmd(value: string): [number, number, number] {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return [y, m, d];
}

// 달력 날짜를 1970-01-01 기준 일수로 — 두 날짜의 차가 곧 달력 일수 차
function toDayNumber(value: string): number {
  const [y, m, d] = parseYmd(value);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

// "2026.10.1 ~ 10.31" — 종료 연도가 같으면 생략. 한쪽이라도 없으면 null (서버가 둘 다/둘 다 없음만 허용)
export function formatInvoicePeriod(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const [sy, sm, sd] = parseYmd(start);
  const [ey, em, ed] = parseYmd(end);
  const endText = sy === ey ? `${em}.${ed}` : `${ey}.${em}.${ed}`;
  return `${sy}.${sm}.${sd} ~ ${endText}`;
}

// 기간권 진행: daysLeft = 종료일 − 오늘 (음수면 이미 종료), ratio = 경과 일수 / 전체 일수 (0..1)
export function getPeriodProgress(
  start: string | null,
  end: string | null,
  today: string,
): { daysLeft: number; ratio: number } | null {
  if (!start || !end) return null;
  const startDay = toDayNumber(start);
  const endDay = toDayNumber(end);
  const todayDay = toDayNumber(today);
  const totalDays = endDay - startDay + 1;
  const elapsedDays = todayDay - startDay + 1;
  return {
    daysLeft: endDay - todayDay,
    ratio: totalDays > 0 ? clamp01(elapsedDays / totalDays) : 0,
  };
}

// 회차권 진행: remaining 은 0 아래로 내려가지 않고, ratio 는 1 에서 멈춘다. totalCount 0 이면 ratio 0
export function getCountProgress(totalCount: number, doneCount: number): { remaining: number; ratio: number } {
  return {
    remaining: Math.max(totalCount - doneCount, 0),
    ratio: totalCount > 0 ? clamp01(doneCount / totalCount) : 0,
  };
}
