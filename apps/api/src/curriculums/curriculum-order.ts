// 커리큘럼 섹션·항목의 순서 계산. Prisma와 무관한 순수 함수라 단위 테스트가 쉽다.
// 묶음(섹션 하나, 또는 섹션 없는 항목들) 단위로만 호출한다.

export type Ordered = { id: number; sortOrder: number };
export type MoveDirection = 'up' | 'down';
export type OrderUpdate = { id: number; sortOrder: number };

function sortRows<T extends Ordered>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/** 묶음 맨 뒤에 붙일 때 쓸 번호 */
export function nextSortOrder(rows: Ordered[]): number {
  if (rows.length === 0) return 0;
  return Math.max(...rows.map(r => r.sortOrder)) + 1;
}

/** 0..n-1로 다시 매긴다. 값이 바뀐 행만 돌려준다(그 행만 UPDATE). */
export function renumber(rows: Ordered[]): OrderUpdate[] {
  const sorted = sortRows(rows);
  const updates: OrderUpdate[] = [];
  sorted.forEach((row, index) => {
    if (row.sortOrder !== index) updates.push({ id: row.id, sortOrder: index });
  });
  return updates;
}

/** 이웃과 자리를 바꾼다. 재번호 후 교환이라 간격·중복이 있어도 결과는 연속 번호. 끝이면 null. */
export function swapWithNeighbor(rows: Ordered[], id: number, direction: MoveDirection): OrderUpdate[] | null {
  const sorted = sortRows(rows);
  const index = sorted.findIndex(r => r.id === id);
  if (index < 0) return null;
  const neighbor = direction === 'up' ? index - 1 : index + 1;
  if (neighbor < 0 || neighbor >= sorted.length) return null;

  const target = sorted.map((row, i) => ({ id: row.id, sortOrder: i }));
  target[index].sortOrder = neighbor;
  target[neighbor].sortOrder = index;

  return target.filter((u, i) => u.sortOrder !== sorted[i].sortOrder);
}
