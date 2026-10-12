import { BadRequestException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import type { PrismaService } from '../prisma/prisma.service';

type Existing = { id: number; studentId: number; periodStart: Date; periodEnd: Date | null };

function makeService(existing: Existing) {
  const update = vi.fn().mockResolvedValue({});
  const findFirst = vi.fn().mockResolvedValue(existing);
  const tx = { invoice: { update }, session: { updateMany: vi.fn() } };
  const prisma = {
    invoice: { findFirst },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
  } as unknown as PrismaService;
  const service = new InvoicesService(prisma);
  vi.spyOn(service, 'findOne').mockResolvedValue({} as never);
  return { service, update };
}

function makeCreateService() {
  const create = vi.fn().mockResolvedValue({ id: 1, uuid: 'u' });
  const prisma = {
    student: { findFirst: vi.fn().mockResolvedValue({ id: 10 }) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({
      invoice: { create },
      session: { updateMany: vi.fn() },
    })),
  } as unknown as PrismaService;
  const service = new InvoicesService(prisma);
  vi.spyOn(service, 'findOne').mockResolvedValue({} as never);
  return { service, create };
}

const bounded: Existing = {
  id: 1,
  studentId: 10,
  periodStart: new Date('2026-10-01'),
  periodEnd: new Date('2026-10-31'),
};
// 종료일 없음 = 무기한 (다음 수강권이 시작하면 자동 귀속은 그쪽이 우선)
const openEnded: Existing = { ...bounded, periodEnd: null };

describe('InvoicesService.update 기간', () => {
  it('문자열로 보내면 Date 로 저장한다', async () => {
    const { service, update } = makeService(bounded);
    await service.update('uuid', { periodStart: '2026-11-01', periodEnd: '2026-11-30' }, 'user');

    const { data } = update.mock.calls[0][0];
    expect(data.periodStart).toEqual(new Date('2026-11-01'));
    expect(data.periodEnd).toEqual(new Date('2026-11-30'));
  });

  it('보내지 않으면 기간을 건드리지 않는다', async () => {
    const { service, update } = makeService(bounded);
    await service.update('uuid', { title: '변경' }, 'user');

    const { data } = update.mock.calls[0][0];
    expect(data).not.toHaveProperty('periodStart');
    expect(data).not.toHaveProperty('periodEnd');
  });

  it('시작일만 바꾸는 부분 수정은 종료일을 건드리지 않는다 (iOS 패턴)', async () => {
    const { service, update } = makeService(bounded);
    await service.update('uuid', { periodStart: '2026-10-05' }, 'user');

    const { data } = update.mock.calls[0][0];
    expect(data.periodStart).toEqual(new Date('2026-10-05'));
    expect(data).not.toHaveProperty('periodEnd');
  });

  it('종료일만 바꾸는 부분 수정은 시작일을 건드리지 않는다 (iOS 패턴)', async () => {
    const { service, update } = makeService(bounded);
    await service.update('uuid', { periodEnd: '2026-10-20' }, 'user');

    const { data } = update.mock.calls[0][0];
    expect(data.periodEnd).toEqual(new Date('2026-10-20'));
    expect(data).not.toHaveProperty('periodStart');
  });

  it('periodEnd 를 null 로 보내면 종료일을 지워 무기한으로 만든다 (1970 으로 저장하지 않는다)', async () => {
    const { service, update } = makeService(bounded);
    await service.update('uuid', { periodEnd: null }, 'user');

    const { data } = update.mock.calls[0][0];
    expect(data.periodEnd).toBeNull();
    expect(data).not.toHaveProperty('periodStart');
  });

  it('무기한 수강권에 종료일을 넣을 수 있다', async () => {
    const { service, update } = makeService(openEnded);
    await service.update('uuid', { periodEnd: '2026-11-30' }, 'user');

    const { data } = update.mock.calls[0][0];
    expect(data.periodEnd).toEqual(new Date('2026-11-30'));
  });

  it('무기한 수강권의 시작일은 종료일 제약 없이 바꿀 수 있다', async () => {
    const { service, update } = makeService(openEnded);
    await service.update('uuid', { periodStart: '2027-01-01' }, 'user');

    const { data } = update.mock.calls[0][0];
    expect(data.periodStart).toEqual(new Date('2027-01-01'));
  });

  it('종료일이 시작일보다 앞서면 거부한다', async () => {
    const { service } = makeService(openEnded);
    await expect(
      service.update('uuid', { periodStart: '2026-11-30', periodEnd: '2026-11-01' }, 'user'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('기존 기간 안에서 종료일만 당겨 시작일보다 앞서게 하면 거부한다', async () => {
    const { service } = makeService(bounded);
    await expect(service.update('uuid', { periodEnd: '2026-09-30' }, 'user')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('기존 기간 안에서 시작일만 늦춰 종료일을 넘기면 거부한다', async () => {
    const { service } = makeService(bounded);
    await expect(service.update('uuid', { periodStart: '2026-11-01' }, 'user')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('InvoicesService.create 기간', () => {
  it('종료일 없이 시작일만으로 만들 수 있다 (무기한)', async () => {
    const { service, create } = makeCreateService();
    await service.create({ studentUuid: 's', price: 0, periodStart: '2026-11-01' }, 'user');

    const { data } = create.mock.calls[0][0];
    expect(data.periodStart).toEqual(new Date('2026-11-01'));
    expect(data.periodEnd).toBeNull();
  });

  it('종료일이 시작일보다 앞서면 거부한다', async () => {
    const { service } = makeCreateService();
    await expect(
      service.create({ studentUuid: 's', price: 0, periodStart: '2026-11-30', periodEnd: '2026-11-01' }, 'user'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('같은 날 시작·종료(하루짜리)는 허용한다', async () => {
    const { service, create } = makeCreateService();
    await service.create({ studentUuid: 's', price: 0, periodStart: '2026-11-01', periodEnd: '2026-11-01' }, 'user');

    const { data } = create.mock.calls[0][0];
    expect(data.periodEnd).toEqual(new Date('2026-11-01'));
  });
});
