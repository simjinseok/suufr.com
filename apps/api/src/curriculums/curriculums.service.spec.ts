import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CurriculumsService } from './curriculums.service';
import type { PrismaService } from '../prisma/prisma.service';

function makePrisma() {
  // 읽기는 prisma 와 tx 가 같은 mock 을 보고, 쓰기는 따로 기록한다(트랜잭션 밖으로 샌 쓰기를 구분하려고)
  const writes = () => ({ create: vi.fn(), update: vi.fn(), updateMany: vi.fn() });
  const sectionReads = { findFirst: vi.fn(), findMany: vi.fn() };
  const itemReads = { findFirst: vi.fn(), findMany: vi.fn() };
  const prisma: any = {
    curriculum: { findFirst: vi.fn() },
    curriculumSection: { ...sectionReads, ...writes() },
    curriculumItem: { ...itemReads, ...writes() },
    mediaFile: { findMany: vi.fn() },
  };
  const tx: any = {
    curriculumSection: { ...sectionReads, ...writes() },
    curriculumItem: { ...itemReads, ...writes() },
    curriculumItemMediaFile: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
  };
  prisma.$transaction = vi.fn(async (arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg)));
  return { prisma, tx };
}

function makeService() {
  const { prisma, tx } = makePrisma();
  const service = new CurriculumsService(prisma as unknown as PrismaService);
  // findOne 은 조회 응답 조립이라 여기서는 통과시킨다
  vi.spyOn(service, 'findOne').mockResolvedValue({ success: true, data: {} } as any);
  return { service, prisma, tx };
}

type Row = { id: number; sortOrder: number; [column: string]: unknown };

/** where 의 동등 조건과 { not } 을 DB처럼 해석한다. 모르는 연산자는 조용히 오판하지 않고 던진다 */
function matches(row: Row, where: Record<string, any>) {
  return Object.entries(where).every(([column, cond]) => {
    if (cond === null || typeof cond !== 'object') return row[column] === cond;
    if (Object.keys(cond).some(op => op !== 'not')) throw new Error(`가짜 테이블이 해석하지 못하는 조건: ${column} ${JSON.stringify(cond)}`);
    return row[column] !== cond.not;
  });
}

/** 순서 계산용 findMany 가짜. orderBy 가 없으니 넣은 순서대로 돌려준다 */
function findManyIn(rows: Row[]) {
  return async ({ where }: { where: Record<string, any> }) =>
    rows.filter(row => matches(row, where)).map(({ id, sortOrder }) => ({ id, sortOrder }));
}

/**
 * 트랜잭션 안에서 쓰고 다시 읽는 경로용 테이블 가짜. update 가 행에 반영돼 같은 트랜잭션의 다음 findMany 가 그 결과를 본다.
 * 실제 DB 처럼 동작해야, 이미 소프트 삭제한 행을 조회 조건으로 한 번 더 빼는지 같은 무해한 차이에 테스트가 흔들리지 않는다
 */
function fakeTable(rows: Row[]) {
  return {
    findMany: findManyIn(rows),
    update: async ({ where, data }: { where: Record<string, any>; data: Record<string, unknown> }) => {
      const row = rows.find(r => matches(r, where));
      if (row) Object.assign(row, data);
      return row;
    },
  };
}

const CURRICULUM = { id: 1, uuid: 'c1' };
const USER = 'u1';

describe('CurriculumsService 섹션', () => {
  it('createSection: 이 커리큘럼의 살아 있는 섹션 맨 뒤 번호로 만든다', async () => {
    const { service, prisma } = makeService();
    prisma.curriculum.findFirst.mockResolvedValue(CURRICULUM);
    prisma.curriculumSection.findMany.mockImplementation(findManyIn([
      { id: 1, curriculumId: 1, sortOrder: 0, deletedAt: null },
      { id: 2, curriculumId: 1, sortOrder: 1, deletedAt: null },
      { id: 5, curriculumId: 1, sortOrder: 4, deletedAt: new Date() }, // 삭제된 섹션
      { id: 9, curriculumId: 2, sortOrder: 7, deletedAt: null }, // 다른 커리큘럼
    ]));
    prisma.curriculumSection.create.mockResolvedValue({ id: 3, uuid: 's3' });

    await service.createSection({ curriculumUuid: 'c1', title: '3개월차' }, USER);

    expect(prisma.curriculumSection.create.mock.calls[0][0].data).toMatchObject({ title: '3개월차', curriculumId: 1, sortOrder: 2 });
  });

  it('updateSection: 보낸 필드만 그 섹션에 갱신하고 커리큘럼 전체를 돌려준다', async () => {
    const { service, prisma } = makeService();
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 2, uuid: 's2', curriculumId: 1, curriculum: CURRICULUM });
    const full = { success: true, data: { uuid: 'c1' } };
    vi.mocked(service.findOne).mockResolvedValue(full as any);

    await expect(service.updateSection('s2', { title: '2개월차' }, USER)).resolves.toBe(full);

    expect(prisma.curriculumSection.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { title: '2개월차' } });
    expect(service.findOne).toHaveBeenCalledWith('c1', USER);
  });

  it('updateSection: 설명만 보내면 설명만 갱신한다', async () => {
    const { service, prisma } = makeService();
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 2, uuid: 's2', curriculumId: 1, curriculum: CURRICULUM });

    await service.updateSection('s2', { description: '복습 위주' }, USER);

    expect(prisma.curriculumSection.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { description: '복습 위주' } });
  });

  it('moveSection down: 같은 커리큘럼의 살아 있는 이웃과 교환해 두 행을 한 트랜잭션으로 갱신한다', async () => {
    const { service, prisma } = makeService();
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 11, uuid: 's11', curriculumId: 1, curriculum: CURRICULUM });
    prisma.curriculumSection.findMany.mockImplementation(findManyIn([
      { id: 11, curriculumId: 1, sortOrder: 0, deletedAt: null },
      { id: 13, curriculumId: 1, sortOrder: 1, deletedAt: new Date() }, // 삭제된 섹션과는 교환하지 않는다
      { id: 12, curriculumId: 1, sortOrder: 2, deletedAt: null },
      { id: 21, curriculumId: 2, sortOrder: 1, deletedAt: null }, // 다른 커리큘럼
    ]));

    await service.moveSection('s11', 'down', USER);

    const updates = prisma.curriculumSection.update.mock.calls.map((c: any) => c[0]);
    expect(updates).toEqual(expect.arrayContaining([
      { where: { id: 11 }, data: { sortOrder: 1 } },
      { where: { id: 12 }, data: { sortOrder: 0 } },
    ]));
    // update 는 $transaction 에 넘겨야 실행되는 지연 쿼리다
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
  });

  it('moveSection: 끝에서 더 가면 아무것도 갱신하지 않고 정상 반환', async () => {
    const { service, prisma } = makeService();
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 2, uuid: 's2', curriculumId: 1, curriculum: CURRICULUM });
    prisma.curriculumSection.findMany.mockResolvedValue([{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 1 }]);

    await service.moveSection('s2', 'down', USER);

    expect(prisma.curriculumSection.update).not.toHaveBeenCalled();
  });

  it('removeSection: 섹션 항목만 원래 순서대로 섹션 없음 맨 뒤로 보내고 섹션은 소프트 삭제, 남은 섹션 재번호', async () => {
    const { service, prisma, tx } = makeService();
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 2, uuid: 's2', curriculumId: 1, curriculum: CURRICULUM });
    // 섹션 없음 묶음에 이미 1개(0번), 삭제할 섹션 안에 2개(조회 순서가 sortOrder 와 다르게 뒤섞여 있다)
    const items = fakeTable([
      { id: 10, curriculumId: 1, sectionId: null, sortOrder: 0, deletedAt: null },
      { id: 21, curriculumId: 1, sectionId: 2, sortOrder: 1, deletedAt: null },
      { id: 20, curriculumId: 1, sectionId: 2, sortOrder: 0, deletedAt: null },
      { id: 30, curriculumId: 1, sectionId: 3, sortOrder: 0, deletedAt: null }, // 다른 섹션 항목은 그대로
    ]);
    prisma.curriculumItem.findMany.mockImplementation(items.findMany);
    tx.curriculumItem.update.mockImplementation(items.update);
    const sections = fakeTable([
      { id: 1, curriculumId: 1, sortOrder: 0, deletedAt: null },
      { id: 2, curriculumId: 1, sortOrder: 1, deletedAt: null }, // 삭제할 섹션
      { id: 3, curriculumId: 1, sortOrder: 2, deletedAt: null },
    ]);
    prisma.curriculumSection.findMany.mockImplementation(sections.findMany);
    tx.curriculumSection.update.mockImplementation(sections.update);

    await service.removeSection('s2', USER);

    const itemUpdates = tx.curriculumItem.update.mock.calls.map((c: any) => c[0]);
    expect(itemUpdates).toEqual([
      { where: { id: 20 }, data: { sectionId: null, sortOrder: 1 } },
      { where: { id: 21 }, data: { sectionId: null, sortOrder: 2 } },
    ]);
    const sectionUpdates = tx.curriculumSection.update.mock.calls.map((c: any) => c[0]);
    expect(sectionUpdates).toEqual(expect.arrayContaining([
      { where: { id: 2 }, data: { deletedAt: expect.any(Date) } },
      { where: { id: 3 }, data: { sortOrder: 1 } },
    ]));
  });
});

describe('CurriculumsService 항목 소속·순서', () => {
  it('createItem: sectionUuid 가 있으면 그 섹션 맨 뒤 번호', async () => {
    const { service, prisma, tx } = makeService();
    vi.spyOn(service, 'findItem').mockResolvedValue({ success: true, data: {} } as any);
    prisma.curriculum.findFirst.mockResolvedValue(CURRICULUM);
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 7, curriculumId: 1 });
    prisma.curriculumItem.findMany.mockImplementation(findManyIn([
      { id: 1, curriculumId: 1, sectionId: 7, sortOrder: 0, deletedAt: null },
      { id: 2, curriculumId: 1, sectionId: 7, sortOrder: 1, deletedAt: null },
      { id: 4, curriculumId: 1, sectionId: null, sortOrder: 5, deletedAt: null }, // 섹션 없음 묶음
    ]));
    tx.curriculumItem.create.mockResolvedValue({ id: 3, uuid: 'i3' });

    await service.createItem({ curriculumUuid: 'c1', title: '3회차', sectionUuid: 's7' }, USER);

    expect(tx.curriculumItem.create.mock.calls[0][0].data).toMatchObject({ sectionId: 7, sortOrder: 2 });
  });

  it('createItem: 삭제된 섹션이면 404', async () => {
    const { service, prisma } = makeService();
    prisma.curriculum.findFirst.mockResolvedValue(CURRICULUM);
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 7, curriculumId: 1, deletedAt: new Date() });

    await expect(service.createItem({ curriculumUuid: 'c1', title: 'x', sectionUuid: 's7' }, USER))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('createItem: 다른 커리큘럼의 섹션이면 400', async () => {
    const { service, prisma } = makeService();
    prisma.curriculum.findFirst.mockResolvedValue(CURRICULUM);
    prisma.curriculumSection.findFirst.mockResolvedValue(null); // 이 커리큘럼 범위로 찾으므로 다른 커리큘럼 섹션은 안 나온다

    await expect(service.createItem({ curriculumUuid: 'c1', title: 'x', sectionUuid: 'other' }, USER))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.curriculumSection.findFirst.mock.calls[0][0].where).toMatchObject({ uuid: 'other', curriculumId: 1 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updateItem: 섹션을 바꾸면 대상 맨 뒤로 가고 원래 묶음은 재번호', async () => {
    const { service, prisma, tx } = makeService();
    vi.spyOn(service, 'findItem').mockResolvedValue({ success: true, data: {} } as any);
    prisma.curriculumItem.findFirst.mockResolvedValue({ id: 5, uuid: 'i5', curriculumId: 1, sectionId: null, sortOrder: 0, mediaFiles: [] });
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 7, curriculumId: 1 });
    const items = fakeTable([
      { id: 5, uuid: 'i5', curriculumId: 1, sectionId: null, sortOrder: 0, deletedAt: null }, // 옮길 항목
      { id: 6, curriculumId: 1, sectionId: null, sortOrder: 1, deletedAt: null }, // 원래 묶음(섹션 없음)
      { id: 8, curriculumId: 1, sectionId: 7, sortOrder: 0, deletedAt: null }, // 대상 섹션(7)
    ]);
    prisma.curriculumItem.findMany.mockImplementation(items.findMany);
    tx.curriculumItem.update.mockImplementation(items.update);

    await service.updateItem('i5', { sectionUuid: 's7' }, USER);

    const updates = tx.curriculumItem.update.mock.calls.map((c: any) => c[0]);
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ where: { uuid: 'i5' }, data: expect.objectContaining({ sectionId: 7, sortOrder: 1 }) }),
      { where: { id: 6 }, data: { sortOrder: 0 } },
    ]));
  });

  it('updateItem: 같은 섹션이면 순서를 건드리지 않는다', async () => {
    const { service, prisma, tx } = makeService();
    vi.spyOn(service, 'findItem').mockResolvedValue({ success: true, data: {} } as any);
    prisma.curriculumItem.findFirst.mockResolvedValue({ id: 5, uuid: 'i5', curriculumId: 1, sectionId: 7, sortOrder: 3, mediaFiles: [] });
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 7, curriculumId: 1 });

    await service.updateItem('i5', { sectionUuid: 's7', title: '바뀜' }, USER);

    const data = tx.curriculumItem.update.mock.calls[0][0].data;
    expect(data.title).toBe('바뀜');
    expect('sortOrder' in data).toBe(false);
    expect(prisma.curriculumItem.findMany).not.toHaveBeenCalled();
  });

  it('updateItem: sectionUuid null 이면 섹션 없음 맨 뒤로', async () => {
    const { service, prisma, tx } = makeService();
    vi.spyOn(service, 'findItem').mockResolvedValue({ success: true, data: {} } as any);
    prisma.curriculumItem.findFirst.mockResolvedValue({ id: 5, uuid: 'i5', curriculumId: 1, sectionId: 7, sortOrder: 0, mediaFiles: [] });
    prisma.curriculumItem.findMany.mockImplementation(findManyIn([
      { id: 1, curriculumId: 1, sectionId: null, sortOrder: 0, deletedAt: null },
      { id: 2, curriculumId: 1, sectionId: null, sortOrder: 1, deletedAt: null },
      { id: 5, curriculumId: 1, sectionId: 7, sortOrder: 0, deletedAt: null }, // 옮길 항목
    ]));

    await service.updateItem('i5', { sectionUuid: null }, USER);

    const data = tx.curriculumItem.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ sectionId: null, sortOrder: 2 });
  });

  it('moveItem up: 같은 묶음 안에서 이웃과 교환해 한 트랜잭션으로 갱신', async () => {
    const { service, prisma } = makeService();
    vi.spyOn(service, 'findItem').mockResolvedValue({ success: true, data: {} } as any);
    prisma.curriculumItem.findFirst.mockResolvedValue({ id: 2, uuid: 'i2', curriculumId: 1, sectionId: 7, sortOrder: 1 });
    prisma.curriculumItem.findMany.mockResolvedValue([{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 1 }]);

    await service.moveItem('i2', 'up', USER);

    const where = prisma.curriculumItem.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ curriculumId: 1, sectionId: 7, deletedAt: null });
    const updates = prisma.curriculumItem.update.mock.calls.map((c: any) => c[0]);
    expect(updates).toEqual(expect.arrayContaining([
      { where: { id: 2 }, data: { sortOrder: 0 } },
      { where: { id: 1 }, data: { sortOrder: 1 } },
    ]));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
  });

  it('removeItem: 트랜잭션 안에서 소프트 삭제 후 같은 묶음만 재번호', async () => {
    const { service, prisma, tx } = makeService();
    prisma.curriculumItem.findFirst.mockResolvedValue({ id: 2, uuid: 'i2', curriculumId: 1, sectionId: null, sortOrder: 1 });
    const items = fakeTable([
      { id: 1, curriculumId: 1, sectionId: null, sortOrder: 0, deletedAt: null },
      { id: 2, uuid: 'i2', curriculumId: 1, sectionId: null, sortOrder: 1, deletedAt: null }, // 지울 항목
      { id: 3, curriculumId: 1, sectionId: null, sortOrder: 2, deletedAt: null },
      { id: 4, curriculumId: 1, sectionId: 7, sortOrder: 1, deletedAt: null }, // 다른 묶음
    ]);
    prisma.curriculumItem.findMany.mockImplementation(items.findMany);
    tx.curriculumItem.update.mockImplementation(items.update);

    await service.removeItem('i2', USER);

    const updates = tx.curriculumItem.update.mock.calls.map((c: any) => c[0]);
    expect(updates).toEqual(expect.arrayContaining([
      { where: { uuid: 'i2' }, data: { deletedAt: expect.any(Date) } },
      { where: { id: 3 }, data: { sortOrder: 1 } },
    ]));
  });
});

describe('CurriculumsService 소유자 확인', () => {
  it.each([
    ['createSection', (service: CurriculumsService) => service.createSection({ curriculumUuid: 'c9', title: 'x' }, USER)],
    ['createItem', (service: CurriculumsService) => service.createItem({ curriculumUuid: 'c9', title: 'x' }, USER)],
  ])('%s: 커리큘럼이 내 것이 아니면 404 (소유자 조건으로 조회)', async (_name, call) => {
    const { service, prisma } = makeService();
    prisma.curriculum.findFirst.mockResolvedValue(null);

    await expect(call(service)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.curriculum.findFirst.mock.calls[0][0].where).toMatchObject({
      uuid: 'c9',
      deletedAt: null,
      organization: { userId: USER, deletedAt: null },
    });
  });

  it.each([
    ['updateSection', (service: CurriculumsService) => service.updateSection('s9', { title: 'x' }, USER)],
    ['moveSection', (service: CurriculumsService) => service.moveSection('s9', 'up', USER)],
    ['removeSection', (service: CurriculumsService) => service.removeSection('s9', USER)],
  ])('%s: 내 커리큘럼의 섹션이 아니면 404 (소유자 조건으로 조회)', async (_name, call) => {
    const { service, prisma } = makeService();
    prisma.curriculumSection.findFirst.mockResolvedValue(null);

    await expect(call(service)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.curriculumSection.findFirst.mock.calls[0][0].where).toMatchObject({
      uuid: 's9',
      deletedAt: null,
      curriculum: { deletedAt: null, organization: { userId: USER, deletedAt: null } },
    });
  });

  it.each([
    ['updateItem', (service: CurriculumsService) => service.updateItem('i9', { title: 'x' }, USER)],
    ['moveItem', (service: CurriculumsService) => service.moveItem('i9', 'up', USER)],
    ['removeItem', (service: CurriculumsService) => service.removeItem('i9', USER)],
  ])('%s: 내 커리큘럼의 항목이 아니면 404 (소유자 조건으로 조회)', async (_name, call) => {
    const { service, prisma } = makeService();
    prisma.curriculumItem.findFirst.mockResolvedValue(null);

    await expect(call(service)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.curriculumItem.findFirst.mock.calls[0][0].where).toMatchObject({
      uuid: 'i9',
      deletedAt: null,
      curriculum: { deletedAt: null, organization: { userId: USER, deletedAt: null } },
    });
  });
});
