const DAY_MS = 24 * 60 * 60 * 1000;

// 'YYYY-MM-DD…'의 날짜 부분을 UTC 자정 타임스탬프로
function dateOnlyUtc(value: string): number {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

// 미납 경과 — periodStart(date-only, UTC 고정)부터 오늘(유저 타임존 날짜)까지. 시작일이 1일째
export function elapsedLabel(periodStart: string, today: string): string {
  const diff = Math.round((dateOnlyUtc(today) - dateOnlyUtc(periodStart)) / DAY_MS);
  return diff < 0 ? '시작 전' : `${diff + 1}일째`;
}

export function sumPrice(invoices: { price: number }[]): number {
  return invoices.reduce((total, invoice) => total + invoice.price, 0);
}
