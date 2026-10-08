import { nextSortOrder, renumber, swapWithNeighbor } from './curriculum-order';

describe('nextSortOrder', () => {
  it('비어 있으면 0', () => {
    expect(nextSortOrder([])).toBe(0);
  });
  it('최댓값 + 1 (간격이 있어도)', () => {
    expect(nextSortOrder([{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 5 }])).toBe(6);
  });
});

describe('renumber', () => {
  it('sortOrder, id 순으로 0부터 다시 매기고 바뀐 행만 돌려준다', () => {
    const rows = [
      { id: 3, sortOrder: 2 },
      { id: 1, sortOrder: 0 },
      { id: 2, sortOrder: 7 },
    ];
    // 반환 순서는 정렬 순(id 3 이 sortOrder 1, id 2 가 sortOrder 2)
    expect(renumber(rows)).toEqual([{ id: 3, sortOrder: 1 }, { id: 2, sortOrder: 2 }]);
  });
  it('중복 sortOrder는 id 작은 쪽이 앞', () => {
    const rows = [{ id: 9, sortOrder: 1 }, { id: 4, sortOrder: 1 }];
    expect(renumber(rows)).toEqual([{ id: 4, sortOrder: 0 }]);
  });
  it('이미 연속이면 빈 배열', () => {
    expect(renumber([{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 1 }])).toEqual([]);
  });
});

describe('swapWithNeighbor', () => {
  const rows = [{ id: 10, sortOrder: 0 }, { id: 20, sortOrder: 1 }, { id: 30, sortOrder: 2 }];
  it('아래로: 다음 행과 교환', () => {
    expect(swapWithNeighbor(rows, 10, 'down')).toEqual([{ id: 10, sortOrder: 1 }, { id: 20, sortOrder: 0 }]);
  });
  it('위로: 이전 행과 교환', () => {
    expect(swapWithNeighbor(rows, 30, 'up')).toEqual([{ id: 20, sortOrder: 2 }, { id: 30, sortOrder: 1 }]);
  });
  it('맨 위에서 위로 → null', () => {
    expect(swapWithNeighbor(rows, 10, 'up')).toBeNull();
  });
  it('맨 아래에서 아래로 → null', () => {
    expect(swapWithNeighbor(rows, 30, 'down')).toBeNull();
  });
  it('없는 id → null', () => {
    expect(swapWithNeighbor(rows, 99, 'down')).toBeNull();
  });
  it('간격이 있어도 교환 결과는 연속 번호', () => {
    const gappy = [{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 5 }, { id: 3, sortOrder: 9 }];
    expect(swapWithNeighbor(gappy, 2, 'down')).toEqual([{ id: 2, sortOrder: 2 }, { id: 3, sortOrder: 1 }]);
  });
});
