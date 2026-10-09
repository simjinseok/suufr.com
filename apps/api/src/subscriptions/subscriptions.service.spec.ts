import { SubscriptionsService } from './subscriptions.service';
import type { PrismaService } from '../prisma/prisma.service';

const service = new SubscriptionsService({} as unknown as PrismaService);
const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

describe('SubscriptionsService.getEffectivePlanOf', () => {
  it('행이 없거나 plan 이 free 면 free', () => {
    expect(service.getEffectivePlanOf(null)).toBe('free');
    expect(service.getEffectivePlanOf({ plan: 'free', status: 'active', currentPeriodEnd: future, gracePeriodExpiresAt: null })).toBe('free');
  });

  it('status 가 expired 면 기간이 남아도 free', () => {
    expect(service.getEffectivePlanOf({ plan: 'pro', status: 'expired', currentPeriodEnd: future, gracePeriodExpiresAt: null })).toBe('free');
  });

  it('currentPeriodEnd 가 null 이면 무기한 — grace 가 과거여도 pro', () => {
    expect(service.getEffectivePlanOf({ plan: 'pro', status: 'active', currentPeriodEnd: null, gracePeriodExpiresAt: past })).toBe('pro');
  });

  it('기간은 지났지만 grace 가 남아 있으면 pro (Apple 유예기간)', () => {
    expect(service.getEffectivePlanOf({ plan: 'pro', status: 'past_due', currentPeriodEnd: past, gracePeriodExpiresAt: future })).toBe('pro');
  });

  it('기간이 남아 있으면 지난 grace 가 남아 있어도 pro (기간 끝은 둘 중 늦은 쪽)', () => {
    expect(service.getEffectivePlanOf({ plan: 'pro', status: 'active', currentPeriodEnd: future, gracePeriodExpiresAt: past })).toBe('pro');
  });

  it('기간도 grace 도 지났으면 free', () => {
    expect(service.getEffectivePlanOf({ plan: 'pro', status: 'past_due', currentPeriodEnd: past, gracePeriodExpiresAt: past })).toBe('free');
  });

  it('grace 가 null 이고 기간이 남아 있으면 pro, 기간이 지났으면 free', () => {
    expect(service.getEffectivePlanOf({ plan: 'pro', status: 'canceled', currentPeriodEnd: future, gracePeriodExpiresAt: null })).toBe('pro');
    expect(service.getEffectivePlanOf({ plan: 'pro', status: 'active', currentPeriodEnd: past, gracePeriodExpiresAt: null })).toBe('free');
  });
});

describe('SubscriptionsService.getSubscribeBlockers', () => {
  it('인증된 free 계정은 차단 사유 없음', () => {
    expect(service.getSubscribeBlockers({ emailVerified: true, effectivePlan: 'free' })).toEqual([]);
  });

  it('미인증이면 email_unverified', () => {
    expect(service.getSubscribeBlockers({ emailVerified: false, effectivePlan: 'free' })).toEqual(['email_unverified']);
  });

  it('이미 pro 면 already_subscribed (미인증이면 둘 다)', () => {
    expect(service.getSubscribeBlockers({ emailVerified: true, effectivePlan: 'pro' })).toEqual(['already_subscribed']);
    expect(service.getSubscribeBlockers({ emailVerified: false, effectivePlan: 'pro' })).toEqual(['email_unverified', 'already_subscribed']);
  });
});

function makeService(emailVerified: boolean, subscription: Record<string, unknown> | null, orders: Record<string, unknown>[] = []) {
  const userFindUnique = vi.fn().mockResolvedValue({ emailVerified });
  const orderFindMany = vi.fn().mockResolvedValue(orders);
  const prisma = {
    userSubscription: { findUnique: vi.fn().mockResolvedValue(subscription) },
    user: { findUnique: userFindUnique },
    student: { count: vi.fn().mockResolvedValue(0) },
    userStorageQuota: { findUnique: vi.fn().mockResolvedValue(null) },
    subscriptionOrder: { findMany: orderFindMany },
  } as unknown as PrismaService;
  return { service: new SubscriptionsService(prisma), userFindUnique, orderFindMany };
}

describe('SubscriptionsService.getSummary — canSubscribe', () => {
  it('인증된 free 계정은 canSubscribe=true', async () => {
    const { service, userFindUnique } = makeService(true, null);
    const summary = await service.getSummary('u1');
    expect(summary.canSubscribe).toBe(true);
    expect(summary.subscribeBlockers).toEqual([]);
    expect(userFindUnique).toHaveBeenCalledWith({ where: { id: 'u1' }, select: { emailVerified: true } });
  });

  it('미인증 free 계정은 canSubscribe=false, email_unverified', async () => {
    const { service } = makeService(false, null);
    const summary = await service.getSummary('u1');
    expect(summary.canSubscribe).toBe(false);
    expect(summary.subscribeBlockers).toEqual(['email_unverified']);
  });

  it('인증된 pro 계정은 canSubscribe=false, already_subscribed', async () => {
    const { service } = makeService(true, { plan: 'pro', status: 'active', currentPeriodEnd: future, gracePeriodExpiresAt: null, provider: 'paddle' });
    const summary = await service.getSummary('u1');
    expect(summary.canSubscribe).toBe(false);
    expect(summary.subscribeBlockers).toEqual(['already_subscribed']);
  });

  it('User 행을 못 찾으면 미인증으로 취급', async () => {
    const { service, userFindUnique } = makeService(true, null);
    userFindUnique.mockResolvedValue(null);
    const summary = await service.getSummary('u1');
    expect(summary.subscribeBlockers).toEqual(['email_unverified']);
  });
});

describe('SubscriptionsService.getSummary — 결제 내역', () => {
  it('본인 주문만 조회하고 providerTransactionId 를 transactionId 로 바꿔 돌려준다', async () => {
    const createdAt = new Date('2026-10-01T00:00:00Z');
    const order = { provider: 'paddle', amount: 6900, currency: 'KRW', status: 'done', failReason: null, approvedAt: createdAt, refundedAt: null, refundedAmount: null, createdAt };
    const { service, orderFindMany } = makeService(true, null, [{ ...order, providerTransactionId: 'txn_1' }]);
    const summary = await service.getSummary('u1');
    expect(summary.orders).toEqual([{ ...order, transactionId: 'txn_1' }]);
    expect(orderFindMany.mock.calls[0][0].where).toEqual({ userId: 'u1' });
  });
});
