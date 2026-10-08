import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CurriculumsService } from './curriculums.service';
import type { PrismaService } from '../prisma/prisma.service';

function makePrisma() {
  const prisma: any = {
    curriculum: { findFirst: vi.fn() },
    curriculumSection: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    curriculumItem: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    mediaFile: { findMany: vi.fn() },
    curriculumItemMediaFile: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
  };
  prisma.$transaction = vi.fn(async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg)));
  return prisma;
}

function makeService() {
  const prisma = makePrisma();
  const service = new CurriculumsService(prisma as unknown as PrismaService);
  // findOne 은 조회 응답 조립이라 여기서는 통과시킨다
  vi.spyOn(service, 'findOne').mockResolvedValue({ success: true, data: {} } as any);
  return { service, prisma };
}

const CURRICULUM = { id: 1, uuid: 'c1' };
const USER = 'u1';

describe('CurriculumsService 섹션', () => {
  it('createSection: 섹션 맨 뒤 번호로 만든다', async () => {
    const { service, prisma } = makeService();
    prisma.curriculum.findFirst.mockResolvedValue(CURRICULUM);
    prisma.curriculumSection.findMany.mockResolvedValue([{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 1 }]);
    prisma.curriculumSection.create.mockResolvedValue({ id: 3, uuid: 's3' });

    await service.createSection({ curriculumUuid: 'c1', title: '3개월차' }, USER);

    expect(prisma.curriculumSection.create.mock.calls[0][0].data).toMatchObject({ title: '3개월차', curriculumId: 1, sortOrder: 2 });
  });

  it('createSection: 커리큘럼이 내 것이 아니면 404', async () => {
    const { service, prisma } = makeService();
    prisma.curriculum.findFirst.mockResolvedValue(null);
    await expect(service.createSection({ curriculumUuid: 'c1', title: 'x' }, USER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('moveSection down: 이웃과 교환해 두 행을 갱신한다', async () => {
    const { service, prisma } = makeService();
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 1, uuid: 's1', curriculumId: 1, curriculum: CURRICULUM });
    prisma.curriculumSection.findMany.mockResolvedValue([{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 1 }]);

    await service.moveSection('s1', 'down', USER);

    const updates = prisma.curriculumSection.update.mock.calls.map((c: any) => c[0]);
    expect(updates).toEqual(expect.arrayContaining([
      { where: { id: 1 }, data: { sortOrder: 1 } },
      { where: { id: 2 }, data: { sortOrder: 0 } },
    ]));
  });

  it('moveSection: 끝에서 더 가면 아무것도 갱신하지 않고 정상 반환', async () => {
    const { service, prisma } = makeService();
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 2, uuid: 's2', curriculumId: 1, curriculum: CURRICULUM });
    prisma.curriculumSection.findMany.mockResolvedValue([{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 1 }]);

    await service.moveSection('s2', 'down', USER);

    expect(prisma.curriculumSection.update).not.toHaveBeenCalled();
  });

  it('removeSection: 항목은 섹션 없음 맨 뒤로 보내고 섹션은 소프트 삭제, 남은 섹션 재번호', async () => {
    const { service, prisma } = makeService();
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 2, uuid: 's2', curriculumId: 1, curriculum: CURRICULUM });
    // 섹션 없음 묶음에 이미 1개(0번), 삭제할 섹션 안에 2개
    prisma.curriculumItem.findMany
      .mockResolvedValueOnce([{ id: 10, sortOrder: 0 }]) // 섹션 없음
      .mockResolvedValueOnce([{ id: 20, sortOrder: 0 }, { id: 21, sortOrder: 1 }]); // 삭제 섹션의 항목
    prisma.curriculumSection.findMany.mockResolvedValue([{ id: 1, sortOrder: 0 }, { id: 3, sortOrder: 2 }]); // 삭제 후 남은 섹션

    await service.removeSection('s2', USER);

    const itemUpdates = prisma.curriculumItem.update.mock.calls.map((c: any) => c[0]);
    expect(itemUpdates).toEqual(expect.arrayContaining([
      { where: { id: 20 }, data: { sectionId: null, sortOrder: 1 } },
      { where: { id: 21 }, data: { sectionId: null, sortOrder: 2 } },
    ]));
    const sectionUpdates = prisma.curriculumSection.update.mock.calls.map((c: any) => c[0]);
    expect(sectionUpdates).toEqual(expect.arrayContaining([
      { where: { id: 2 }, data: { deletedAt: expect.any(Date) } },
      { where: { id: 3 }, data: { sortOrder: 1 } },
    ]));
  });
});

describe('CurriculumsService 항목 소속·순서', () => {
  it('createItem: sectionUuid 가 있으면 그 섹션 맨 뒤 번호', async () => {
    const { service, prisma } = makeService();
    vi.spyOn(service, 'findItem').mockResolvedValue({ success: true, data: {} } as any);
    prisma.curriculum.findFirst.mockResolvedValue(CURRICULUM);
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 7, curriculumId: 1 });
    prisma.curriculumItem.findMany.mockResolvedValue([{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 1 }]);
    prisma.curriculumItem.create.mockResolvedValue({ id: 3, uuid: 'i3' });

    await service.createItem({ curriculumUuid: 'c1', title: '3회차', sectionUuid: 's7' }, USER);

    expect(prisma.curriculumItem.create.mock.calls[0][0].data).toMatchObject({ sectionId: 7, sortOrder: 2 });
  });

  it('createItem: 삭제된 섹션이면 404', async () => {
    const { service, prisma } = makeService();
    prisma.curriculum.findFirst.mockResolvedValue(CURRICULUM);
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 7, curriculumId: 1, deletedAt: new Date() });

    await expect(service.createItem({ curriculumUuid: 'c1', title: 'x', sectionUuid: 's7' }, USER))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.curriculumItem.create).not.toHaveBeenCalled();
  });

  it('createItem: 다른 커리큘럼의 섹션이면 400', async () => {
    const { service, prisma } = makeService();
    prisma.curriculum.findFirst.mockResolvedValue(CURRICULUM);
    prisma.curriculumSection.findFirst.mockResolvedValue(null); // where 에 curriculumId 조건이 있어 못 찾음

    await expect(service.createItem({ curriculumUuid: 'c1', title: 'x', sectionUuid: 'other' }, USER))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.curriculumItem.create).not.toHaveBeenCalled();
  });

  it('updateItem: 섹션을 바꾸면 대상 맨 뒤로 가고 원래 묶음은 재번호', async () => {
    const { service, prisma } = makeService();
    vi.spyOn(service, 'findItem').mockResolvedValue({ success: true, data: {} } as any);
    prisma.curriculumItem.findFirst.mockResolvedValue({ id: 5, uuid: 'i5', curriculumId: 1, sectionId: null, sortOrder: 0, mediaFiles: [] });
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 7, curriculumId: 1 });
    prisma.curriculumItem.findMany
      .mockResolvedValueOnce([{ id: 8, sortOrder: 0 }]) // 대상 섹션(7)
      .mockResolvedValueOnce([{ id: 6, sortOrder: 1 }]); // 원래 묶음(null)에서 5 제외 후 남은 것

    await service.updateItem('i5', { sectionUuid: 's7' }, USER);

    const updates = prisma.curriculumItem.update.mock.calls.map((c: any) => c[0]);
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ where: { uuid: 'i5' }, data: expect.objectContaining({ sectionId: 7, sortOrder: 1 }) }),
      { where: { id: 6 }, data: { sortOrder: 0 } },
    ]));
  });

  it('updateItem: 같은 섹션이면 순서를 건드리지 않는다', async () => {
    const { service, prisma } = makeService();
    vi.spyOn(service, 'findItem').mockResolvedValue({ success: true, data: {} } as any);
    prisma.curriculumItem.findFirst.mockResolvedValue({ id: 5, uuid: 'i5', curriculumId: 1, sectionId: 7, sortOrder: 3, mediaFiles: [] });
    prisma.curriculumSection.findFirst.mockResolvedValue({ id: 7, curriculumId: 1 });

    await service.updateItem('i5', { sectionUuid: 's7', title: '바뀜' }, USER);

    const data = prisma.curriculumItem.update.mock.calls[0][0].data;
    expect(data.title).toBe('바뀜');
    expect('sortOrder' in data).toBe(false);
    expect(prisma.curriculumItem.findMany).not.toHaveBeenCalled();
  });

  it('updateItem: sectionUuid null 이면 섹션 없음 맨 뒤로', async () => {
    const { service, prisma } = makeService();
    vi.spyOn(service, 'findItem').mockResolvedValue({ success: true, data: {} } as any);
    prisma.curriculumItem.findFirst.mockResolvedValue({ id: 5, uuid: 'i5', curriculumId: 1, sectionId: 7, sortOrder: 0, mediaFiles: [] });
    prisma.curriculumItem.findMany
      .mockResolvedValueOnce([{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 1 }]) // 섹션 없음
      .mockResolvedValueOnce([]); // 원래 섹션 남은 것

    await service.updateItem('i5', { sectionUuid: null }, USER);

    const data = prisma.curriculumItem.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ sectionId: null, sortOrder: 2 });
  });

  it('moveItem up: 같은 묶음 안에서 이웃과 교환', async () => {
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
  });

  it('removeItem: 소프트 삭제 후 남은 묶음을 재번호', async () => {
    const { service, prisma } = makeService();
    prisma.curriculumItem.findFirst.mockResolvedValue({ id: 2, uuid: 'i2', curriculumId: 1, sectionId: null, sortOrder: 1 });
    prisma.curriculumItem.findMany.mockResolvedValue([{ id: 1, sortOrder: 0 }, { id: 3, sortOrder: 2 }]);

    await service.removeItem('i2', USER);

    const updates = prisma.curriculumItem.update.mock.calls.map((c: any) => c[0]);
    expect(updates).toEqual(expect.arrayContaining([
      { where: { uuid: 'i2' }, data: { deletedAt: expect.any(Date) } },
      { where: { id: 3 }, data: { sortOrder: 1 } },
    ]));
  });
});
