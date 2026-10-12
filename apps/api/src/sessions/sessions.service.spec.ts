import { SessionsService } from './sessions.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { GoogleCalendarService } from '../google/services/google-calendar.service';
import type { SettingsService } from '../settings/settings.service';

// 세션 생성 시 기간 정액 수강권 자동 귀속 — 조회 조건만 검증한다 (DB 는 모킹)
function makeService(covering: { id: number } | null) {
  const invoiceFindFirst = vi.fn().mockResolvedValue(covering);
  const sessionCreate = vi.fn().mockResolvedValue({ id: 1, uuid: 's' });
  const prisma = {
    student: { findFirst: vi.fn().mockResolvedValue({ id: 10 }) },
    invoice: { findFirst: invoiceFindFirst },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({
      session: { create: sessionCreate },
      sessionMediaFile: { create: vi.fn() },
    })),
  } as unknown as PrismaService;
  const google = { pushSession: vi.fn().mockResolvedValue(undefined) } as unknown as GoogleCalendarService;
  const settings = { resolveTimezone: vi.fn().mockResolvedValue('Asia/Seoul') } as unknown as SettingsService;

  const service = new SessionsService(prisma, google, settings);
  vi.spyOn(service, 'findOne').mockResolvedValue({} as never);
  return { service, invoiceFindFirst, sessionCreate };
}

describe('SessionsService.create 자동 귀속', () => {
  it('유저 타임존의 세션 날짜가 시작일 이후이고, 종료일이 없거나 종료일 이전인 정액 수강권을 찾는다', async () => {
    const { service, invoiceFindFirst } = makeService({ id: 7 });
    // KST 2026-10-15 01:00 = UTC 2026-10-14 16:00 — 날짜는 유저 타임존 기준 15일이어야 한다
    await service.create({ studentUuid: 'st', sessionAt: '2026-10-14T16:00:00.000Z' }, 'user');

    const { where, orderBy } = invoiceFindFirst.mock.calls[0][0];
    const sessionDate = new Date(Date.UTC(2026, 9, 15));
    expect(where).toMatchObject({
      studentId: 10,
      deletedAt: null,
      totalCount: null,
      periodStart: { lte: sessionDate },
      OR: [{ periodEnd: null }, { periodEnd: { gte: sessionDate } }],
    });
    // 겹치면 가장 늦게 시작한 수강권 우선
    expect(orderBy).toEqual({ periodStart: 'desc' });
  });

  it('커버하는 수강권이 있으면 그 수강권에 귀속해 저장한다', async () => {
    const { service, sessionCreate } = makeService({ id: 7 });
    await service.create({ studentUuid: 'st', sessionAt: '2026-10-14T16:00:00.000Z' }, 'user');

    expect(sessionCreate.mock.calls[0][0].data.invoiceId).toBe(7);
  });

  it('커버하는 수강권이 없으면 미연결로 저장한다', async () => {
    const { service, sessionCreate } = makeService(null);
    await service.create({ studentUuid: 'st', sessionAt: '2026-10-14T16:00:00.000Z' }, 'user');

    expect(sessionCreate.mock.calls[0][0].data.invoiceId).toBeNull();
  });

  it('수강권을 명시하면 자동 귀속 조회를 하지 않는다', async () => {
    const { service, invoiceFindFirst, sessionCreate } = makeService({ id: 7 });
    await service.create({ studentUuid: 'st', sessionAt: '2026-10-14T16:00:00.000Z', invoiceUuid: 'inv' }, 'user');

    // 명시 귀속은 uuid 로 1회 조회하고 끝 — 기간 조건 조회가 없어야 한다
    expect(invoiceFindFirst).toHaveBeenCalledTimes(1);
    expect(invoiceFindFirst.mock.calls[0][0].where).toMatchObject({ uuid: 'inv', studentId: 10 });
    expect(sessionCreate.mock.calls[0][0].data.invoiceId).toBe(7);
  });
});
