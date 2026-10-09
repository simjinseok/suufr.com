import { BadRequestException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import type { PrismaService } from '../prisma/prisma.service';

type Existing = { id: number; studentId: number; periodStart: Date | null; periodEnd: Date | null };

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

const withPeriod: Existing = {
  id: 1,
  studentId: 10,
  periodStart: new Date('2026-10-01'),
  periodEnd: new Date('2026-10-31'),
};
const withoutPeriod: Existing = { ...withPeriod, periodStart: null, periodEnd: null };

describe('InvoicesService.update 기간', () => {
  it('periodStart/periodEnd 를 null 로 보내면 기간을 지운다 (1970 으로 저장하지 않는다)', async () => {
    const { service, update } = makeService(withPeriod);
    await service.update('uuid', { periodStart: null, periodEnd: null }, 'user');

    const { data } = update.mock.calls[0][0];
    expect(data.periodStart).toBeNull();
    expect(data.periodEnd).toBeNull();
  });

  it('문자열로 보내면 Date 로 저장한다', async () => {
    const { service, update } = makeService(withoutPeriod);
    await service.update('uuid', { periodStart: '2026-11-01', periodEnd: '2026-11-30' }, 'user');

    const { data } = update.mock.calls[0][0];
    expect(data.periodStart).toEqual(new Date('2026-11-01'));
    expect(data.periodEnd).toEqual(new Date('2026-11-30'));
  });

  it('보내지 않으면 기간을 건드리지 않는다', async () => {
    const { service, update } = makeService(withPeriod);
    await service.update('uuid', { title: '변경' }, 'user');

    const { data } = update.mock.calls[0][0];
    expect(data).not.toHaveProperty('periodStart');
    expect(data).not.toHaveProperty('periodEnd');
  });

  it('기존 기간이 있을 때 시작일만 바꾸는 부분 수정은 허용하고 종료일은 건드리지 않는다 (iOS 패턴)', async () => {
    const { service, update } = makeService(withPeriod);
    await service.update('uuid', { periodStart: '2026-10-05' }, 'user');

    const { data } = update.mock.calls[0][0];
    expect(data.periodStart).toEqual(new Date('2026-10-05'));
    expect(data).not.toHaveProperty('periodEnd');
  });

  it('기존 기간이 있을 때 종료일만 바꾸는 부분 수정은 허용하고 시작일은 건드리지 않는다 (iOS 패턴)', async () => {
    const { service, update } = makeService(withPeriod);
    await service.update('uuid', { periodEnd: '2026-10-20' }, 'user');

    const { data } = update.mock.calls[0][0];
    expect(data.periodEnd).toEqual(new Date('2026-10-20'));
    expect(data).not.toHaveProperty('periodStart');
  });

  it('결과적으로 시작일만 남으면 거부한다', async () => {
    const { service } = makeService(withPeriod);
    await expect(service.update('uuid', { periodEnd: null }, 'user')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('기간 없는 수강권에 종료일만 넣으면 거부한다', async () => {
    const { service } = makeService(withoutPeriod);
    await expect(service.update('uuid', { periodEnd: '2026-11-30' }, 'user')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('종료일이 시작일보다 앞서면 거부한다', async () => {
    const { service } = makeService(withoutPeriod);
    await expect(
      service.update('uuid', { periodStart: '2026-11-30', periodEnd: '2026-11-01' }, 'user'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('기존 기간 안에서 종료일만 당겨 시작일보다 앞서게 하면 거부한다', async () => {
    const { service } = makeService(withPeriod);
    await expect(service.update('uuid', { periodEnd: '2026-09-30' }, 'user')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('한쪽만 있는 레거시 기간이라도 기간을 건드리지 않는 수정은 허용한다', async () => {
    const { service, update } = makeService({ ...withPeriod, periodEnd: null });
    await service.update('uuid', { title: '제목만' }, 'user');
    expect(update).toHaveBeenCalled();
  });
});

describe('InvoicesService.create 기간', () => {
  it('시작일·종료일 중 하나만 있으면 거부한다', async () => {
    const prisma = {
      student: { findFirst: vi.fn().mockResolvedValue({ id: 10 }) },
    } as unknown as PrismaService;
    const service = new InvoicesService(prisma);
    await expect(
      service.create({ studentUuid: 's', price: 0, periodStart: '2026-11-01' }, 'user'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('종료일이 시작일보다 앞서면 거부한다', async () => {
    const prisma = {
      student: { findFirst: vi.fn().mockResolvedValue({ id: 10 }) },
    } as unknown as PrismaService;
    const service = new InvoicesService(prisma);
    await expect(
      service.create({ studentUuid: 's', price: 0, periodStart: '2026-11-30', periodEnd: '2026-11-01' }, 'user'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('같은 날 시작·종료(하루짜리)는 허용한다', async () => {
    const prisma = {
      student: { findFirst: vi.fn().mockResolvedValue({ id: 10 }) },
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({
        invoice: { create: vi.fn().mockResolvedValue({ id: 1, uuid: 'u' }) },
        session: { updateMany: vi.fn() },
      })),
    } as unknown as PrismaService;
    const service = new InvoicesService(prisma);
    vi.spyOn(service, 'findOne').mockResolvedValue({} as never);
    await expect(
      service.create({ studentUuid: 's', price: 0, periodStart: '2026-11-01', periodEnd: '2026-11-01' }, 'user'),
    ).resolves.toBeDefined();
  });
});
