// 청구 파생 계산 (docs/schema-redesign.md §3) — 상태는 저장하지 않고 항상 계산한다
// 납부 상태는 청구가 아니라 학생 단위 잔액(서버 파생)으로 판정한다 — 여기엔 세션 축 계산만 남는다

type InvoiceLike = {
  totalCount?: number | null;
  sessions?: Array<{ isDone: boolean }>;
};

// 잔여 회차 (totalCount 있는 회차 수강권): totalCount − done 귀속 세션 수
export function getRemainingCount(invoice: InvoiceLike): number | null {
  if (invoice.totalCount == null) return null;
  const doneCount = invoice.sessions?.filter(s => s.isDone).length ?? 0;
  return Math.max(invoice.totalCount - doneCount, 0);
}
