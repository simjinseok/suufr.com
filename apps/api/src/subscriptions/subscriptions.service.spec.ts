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

  it('기간도 grace 도 지났으면 free', () => {
    expect(service.getEffectivePlanOf({ plan: 'pro', status: 'past_due', currentPeriodEnd: past, gracePeriodExpiresAt: past })).toBe('free');
  });

  it('grace 가 null 이고 기간이 남아 있으면 pro, 기간이 지났으면 free', () => {
    expect(service.getEffectivePlanOf({ plan: 'pro', status: 'canceled', currentPeriodEnd: future, gracePeriodExpiresAt: null })).toBe('pro');
    expect(service.getEffectivePlanOf({ plan: 'pro', status: 'active', currentPeriodEnd: past, gracePeriodExpiresAt: null })).toBe('free');
  });
});
