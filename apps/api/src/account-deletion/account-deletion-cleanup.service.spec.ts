import {
  AccountDeletionCleanupService,
  CONSENT_RETENTION_YEARS,
  PAYMENT_RECORD_RETENTION_YEARS,
  retentionCutoff,
} from './account-deletion-cleanup.service';
import { STALE_CLAIM_MS } from './account-deletion.service';

vi.mock('@sentry/nestjs', () => ({ captureException: vi.fn() }));

const DELETED = '11111111-1111-4111-8111-111111111111';
const ALIVE = '22222222-2222-4222-8222-222222222222';

function build(tombstones: Array<{ userId: string; deletedAt: Date; storagePurgedAt?: Date | null }>, aliveUserIds: string[] = []) {
  const prisma = {
    accountDeletion: {
      findMany: vi.fn(async ({ where }: { where: { deletedAt: { lt: Date }; userId?: { gt: string }; storagePurgedAt?: null } }) =>
        tombstones
          .filter(t => t.deletedAt < where.deletedAt.lt)
          .filter(t => !where.userId || t.userId > where.userId.gt)
          .filter(t => where.storagePurgedAt !== null || !t.storagePurgedAt)
          .map(t => ({ userId: t.userId }))),
      delete: vi.fn().mockReturnValue('accountDeletion.delete'),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.filter(id => aliveUserIds.includes(id)).map(id => ({ id }))),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (aliveUserIds.includes(where.id) ? { id: where.id } : null)),
    },
    userConsent: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    subscriptionOrder: { deleteMany: vi.fn().mockReturnValue('subscriptionOrder.deleteMany') },
    billingWebhookEvent: { deleteMany: vi.fn().mockReturnValue('billingWebhookEvent.deleteMany') },
    $transaction: vi.fn().mockResolvedValue([]),
  };
  const accountDeletion = { purgeStorage: vi.fn().mockResolvedValue(true) };
  const service = new AccountDeletionCleanupService(prisma as never, accountDeletion as never);
  return { service, prisma, accountDeletion };
}

const ago = (ms: number) => new Date(Date.now() - ms);
/** 달력 기준 years 년 전보다 ms 더 이전 */
const yearsAgo = (years: number, ms = 1000) => new Date(retentionCutoff(new Date(), years).getTime() - ms);

describe('retentionCutoff', () => {
  it('365일×N 이 아니라 달력 기준으로 계산한다 (윤년이 끼어도 하루 일찍 파기하지 않는다)', () => {
    expect(retentionCutoff(new Date('2031-11-22T03:00:00Z'), 5).toISOString()).toBe('2026-11-22T03:00:00.000Z');
    expect(retentionCutoff(new Date('2029-11-22T03:00:00Z'), 3).toISOString()).toBe('2026-11-22T03:00:00.000Z');
  });
});

describe('AccountDeletionCleanupService.purgeExpiredRecords', () => {
  it('3년 지난 탈퇴의 동의 이력만 지우고, 결제 기록·탈퇴 기록은 5년까지 남긴다', async () => {
    const ctx = build([{ userId: DELETED, deletedAt: yearsAgo(CONSENT_RETENTION_YEARS) }]);
    await ctx.service.purgeExpiredRecords();
    expect(ctx.prisma.userConsent.deleteMany).toHaveBeenCalledWith({ where: { userId: { in: [DELETED] } } });
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('5년 지나면 주문·웹훅 원문(custom_data.userId)·탈퇴 기록을 한 트랜잭션으로 지운다', async () => {
    const ctx = build([{ userId: DELETED, deletedAt: yearsAgo(PAYMENT_RECORD_RETENTION_YEARS) }]);
    await ctx.service.purgeExpiredRecords();
    expect(ctx.prisma.subscriptionOrder.deleteMany).toHaveBeenCalledWith({ where: { userId: DELETED } });
    expect(ctx.prisma.billingWebhookEvent.deleteMany).toHaveBeenCalledWith({ where: { payload: { path: ['data', 'custom_data', 'userId'], equals: DELETED } } });
    expect(ctx.prisma.accountDeletion.delete).toHaveBeenCalledWith({ where: { userId: DELETED } });
    expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('users 가 남아 있는(완료되지 않은) 기록은 기간이 지나도 건드리지 않는다', async () => {
    const ctx = build([{ userId: ALIVE, deletedAt: yearsAgo(PAYMENT_RECORD_RETENTION_YEARS) }], [ALIVE]);
    await ctx.service.purgeExpiredRecords();
    expect(ctx.prisma.userConsent.deleteMany).not.toHaveBeenCalled();
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('AccountDeletionCleanupService.retryPendingStorage', () => {
  it('완료된 탈퇴는 스토리지 삭제를 다시 시도하고, users 가 남은 오래된 선점은 푼다', async () => {
    const ctx = build([
      { userId: DELETED, deletedAt: ago(STALE_CLAIM_MS + 1000), storagePurgedAt: null },
      { userId: ALIVE, deletedAt: ago(STALE_CLAIM_MS + 1000), storagePurgedAt: null },
    ], [ALIVE]);
    await ctx.service.retryPendingStorage();
    expect(ctx.accountDeletion.purgeStorage).toHaveBeenCalledWith(DELETED);
    expect(ctx.accountDeletion.purgeStorage).not.toHaveBeenCalledWith(ALIVE);
    expect(ctx.prisma.accountDeletion.deleteMany).toHaveBeenCalledWith({ where: { userId: ALIVE, deletedAt: { lt: expect.any(Date) } } });
  });
});
