import { StudentsService } from './students.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ProfileImageService } from '../s3/profile-image.service';
import type { SubscriptionsService } from '../subscriptions/subscriptions.service';

// 잔액 계산은 별도 모듈이라 빈 결과로 대체한다
vi.mock('../common/utils/student-balance', () => ({
  getStudentBalances: vi.fn().mockResolvedValue(new Map()),
  EMPTY_BALANCE: { outstandingAmount: 0, creditAmount: 0 },
}));

// 수강생 요약 집계 조건만 검증한다 (DB 는 모킹)
function makeService(invoices: { sessions: { status: string }[] }[] = []) {
  const sessionCount = vi.fn().mockResolvedValue(0);
  const invoiceFindMany = vi.fn().mockResolvedValue(invoices);
  const prisma = {
    student: { findFirst: vi.fn().mockResolvedValue({ id: 10, nextPaymentAt: null }) },
    session: { count: sessionCount },
    invoice: { findMany: invoiceFindMany },
  } as unknown as PrismaService;

  const service = new StudentsService(
    prisma,
    {} as ProfileImageService,
    {} as SubscriptionsService,
  );
  return { service, sessionCount, invoiceFindMany };
}

describe('StudentsService.getStats', () => {
  it('남은 수업 수는 예정인 수업만 센다', async () => {
    const { service, sessionCount } = makeService();

    await service.getStats('st', 'user');

    expect(sessionCount).toHaveBeenCalledTimes(1);
    const { where } = sessionCount.mock.calls[0][0];
    expect(where).toMatchObject({ studentId: 10, status: 'scheduled', deletedAt: null });
  });

  it('결석과 완료만 있는 수강권은 다 끝난 수강권으로 센다', async () => {
    const { service } = makeService([
      { sessions: [{ status: 'done' }, { status: 'absent' }] },
      { sessions: [{ status: 'done' }, { status: 'scheduled' }] },
    ]);

    const result = await service.getStats('st', 'user');

    expect(result.data.completedInvoiceCount).toBe(1);
  });
});
