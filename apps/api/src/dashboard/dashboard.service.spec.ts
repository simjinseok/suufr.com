import { DashboardService } from './dashboard.service';
import { zonedDayStart, zonedMonthStart } from '../common/utils/timezone';
import type { PrismaService } from '../prisma/prisma.service';
import type { SettingsService } from '../settings/settings.service';

// 대시보드 조회 조건만 검증한다 (DB 는 모킹)
function makeService(organizations: { id: number }[] = [{ id: 1 }]) {
  const sessionFindMany = vi.fn().mockResolvedValue([]);
  const studentFindMany = vi.fn().mockResolvedValue([]);
  const invoiceFindMany = vi.fn().mockResolvedValue([]);
  const prisma = {
    organization: { findMany: vi.fn().mockResolvedValue(organizations) },
    student: { count: vi.fn().mockResolvedValue(0), findMany: studentFindMany },
    invoice: { findMany: invoiceFindMany },
    studentStatus: { count: vi.fn().mockResolvedValue(0) },
    meeting: { findMany: vi.fn().mockResolvedValue([]) },
    session: { count: vi.fn().mockResolvedValue(0), findMany: sessionFindMany },
  } as unknown as PrismaService;
  const settings = { resolveTimezone: vi.fn().mockResolvedValue('Asia/Seoul') } as unknown as SettingsService;

  const service = new DashboardService(prisma, settings);
  return { service, sessionFindMany, studentFindMany, invoiceFindMany };
}

describe('DashboardService.getDashboardData 오늘 수업', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // UTC 04:20 = KST 2026-11-22 13:20
    vi.setSystemTime(new Date('2026-11-22T04:20:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('오늘 수업은 유저 타임존의 오늘 범위에서 삭제되지 않은 세션을 시작 시각 순으로 가져온다', async () => {
    const { service, sessionFindMany } = makeService();
    const rows = [
      { uuid: 's1', sessionAt: new Date('2026-11-22T01:00:00Z'), duration: 60, isDone: true, student: { uuid: 'st1', name: '김' } },
    ];
    sessionFindMany.mockResolvedValue(rows);

    const result = await service.getDashboardData('user');

    expect(sessionFindMany).toHaveBeenCalledTimes(1);
    const { where, orderBy, select } = sessionFindMany.mock.calls[0][0];
    expect(where).toEqual({
      deletedAt: null,
      sessionAt: {
        gte: zonedDayStart(2026, 11, 22, 'Asia/Seoul'),
        lt: zonedDayStart(2026, 11, 23, 'Asia/Seoul'),
      },
      student: { deletedAt: null, organizationId: { in: [1] } },
    });
    expect(orderBy).toEqual({ sessionAt: 'asc' });
    expect(select).toEqual({
      uuid: true,
      sessionAt: true,
      duration: true,
      isDone: true,
      student: { select: { uuid: true, name: true } },
    });
    expect(result.data.todaySessions).toEqual(rows);
  });

  it('조직이 없으면 todaySessions는 빈 배열', async () => {
    const { service, sessionFindMany } = makeService([]);

    const result = await service.getDashboardData('user');

    expect(result.data.todaySessions).toEqual([]);
    expect(sessionFindMany).not.toHaveBeenCalled();
  });
});

describe('DashboardService.getMonthMatrix', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T04:20:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('대상 학생 조건은 active 또는 그 달 세션 보유', async () => {
    const { service, studentFindMany } = makeService();

    await service.getMonthMatrix('user', '2026-11');

    const monthRange = {
      gte: zonedMonthStart(2026, 11, 'Asia/Seoul'),
      lt: zonedMonthStart(2026, 12, 'Asia/Seoul'),
    };
    const { where } = studentFindMany.mock.calls[0][0];
    expect(where).toEqual({
      deletedAt: null,
      organizationId: { in: [1] },
      OR: [
        { status: 'active' },
        { sessions: { some: { deletedAt: null, sessionAt: monthRange } } },
      ],
    });
  });

  it('수강권은 그 달과 겹치는 미삭제 수강권만 가져온다', async () => {
    const { service, invoiceFindMany } = makeService();

    await service.getMonthMatrix('user', '2026-11');

    const { where } = invoiceFindMany.mock.calls[0][0];
    expect(where).toEqual({
      deletedAt: null,
      student: { deletedAt: null, organizationId: { in: [1] } },
      periodStart: { lte: new Date(Date.UTC(2026, 10, 30)) },
      OR: [{ periodEnd: null }, { periodEnd: { gte: new Date(Date.UTC(2026, 10, 1)) } }],
    });
  });

  it('month가 없으면 유저 타임존의 이번 달', async () => {
    const { service } = makeService();

    const result = await service.getMonthMatrix('user');

    expect(result).toEqual({
      success: true,
      data: { month: '2026-11', daysInMonth: 30, today: '2026-11-22', rows: [] },
    });
  });

  it('조직이 없으면 빈 행으로 응답한다', async () => {
    const { service, studentFindMany } = makeService([]);

    const result = await service.getMonthMatrix('user', '2026-02');

    expect(result.data).toEqual({ month: '2026-02', daysInMonth: 28, today: null, rows: [] });
    expect(studentFindMany).not.toHaveBeenCalled();
  });
});
