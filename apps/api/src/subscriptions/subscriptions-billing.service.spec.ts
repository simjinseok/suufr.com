import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { UserSubscription } from '@prisma/generated/client';
import { SubscriptionsBillingService } from './subscriptions-billing.service';
import type { PaddleClient } from './paddle.client';
import type { PrismaService } from '../prisma/prisma.service';

const USER_A = '11111111-1111-4111-8111-111111111111';
const future = new Date(Date.now() + 86_400_000);

function makeService(subscription: Partial<UserSubscription> | null, order: { userId: string; status: string } | null = null) {
  const updateMany = vi.fn().mockResolvedValue({});
  const prisma = {
    userSubscription: { findUnique: vi.fn().mockResolvedValue(subscription), updateMany },
    subscriptionOrder: { findUnique: vi.fn().mockResolvedValue(order) },
  } as unknown as PrismaService;
  const paddle = {
    cancelAtPeriodEnd: vi.fn().mockResolvedValue({}),
    removeScheduledChange: vi.fn().mockResolvedValue({}),
    getInvoiceUrl: vi.fn().mockResolvedValue('https://invoice'),
  } as unknown as PaddleClient;
  return { service: new SubscriptionsBillingService(prisma, paddle), prisma, paddle, updateMany };
}

const paddleActive: Partial<UserSubscription> = { userId: USER_A, plan: 'pro', status: 'active', provider: 'paddle', providerSubscriptionId: 'sub_1', currentPeriodEnd: future };

async function errorCodeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  }
  catch (error) {
    const response = (error as BadRequestException).getResponse() as { error?: string };
    return response.error;
  }
}

describe('SubscriptionsBillingService.cancel / resume — provider 분기', () => {
  it('paddle 활성 구독은 Paddle 에 해지 예약하고 로컬을 canceled 로', async () => {
    const { service, paddle, updateMany } = makeService(paddleActive);
    await service.cancel(USER_A);
    expect(paddle.cancelAtPeriodEnd).toHaveBeenCalledWith('sub_1');
    expect(updateMany.mock.calls[0][0].data.status).toBe('canceled');
    expect(updateMany.mock.calls[0][0].where).toEqual({ userId: USER_A, provider: 'paddle', providerSubscriptionId: 'sub_1' });
  });

  it('apple/google 구독은 SUBSCRIPTION_MANAGED_BY_STORE', async () => {
    for (const provider of ['apple', 'google'] as const) {
      const { service, paddle } = makeService({ ...paddleActive, provider, providerSubscriptionId: 'O1' });
      expect(await errorCodeOf(service.cancel(USER_A))).toBe('SUBSCRIPTION_MANAGED_BY_STORE');
      expect(await errorCodeOf(service.resume(USER_A))).toBe('SUBSCRIPTION_MANAGED_BY_STORE');
      expect(paddle.cancelAtPeriodEnd).not.toHaveBeenCalled();
    }
  });

  it('manual 구독과 행 없음은 기존 코드 그대로 NOT_CANCELABLE / NOT_RESUMABLE', async () => {
    const manual = makeService({ ...paddleActive, provider: 'manual', providerSubscriptionId: null, currentPeriodEnd: null });
    expect(await errorCodeOf(manual.service.cancel(USER_A))).toBe('SUBSCRIPTION_NOT_CANCELABLE');
    expect(await errorCodeOf(manual.service.resume(USER_A))).toBe('SUBSCRIPTION_NOT_RESUMABLE');
    const none = makeService(null);
    expect(await errorCodeOf(none.service.cancel(USER_A))).toBe('SUBSCRIPTION_NOT_CANCELABLE');
  });

  it('paddle canceled 구독은 재개할 수 있다', async () => {
    const { service, paddle, updateMany } = makeService({ ...paddleActive, status: 'canceled', canceledAt: new Date() });
    await service.resume(USER_A);
    expect(paddle.removeScheduledChange).toHaveBeenCalledWith('sub_1');
    expect(updateMany.mock.calls[0][0].data).toMatchObject({ status: 'active', canceledAt: null });
    expect(updateMany.mock.calls[0][0].where).toEqual({ userId: USER_A, provider: 'paddle', providerSubscriptionId: 'sub_1' });
  });
});

describe('SubscriptionsBillingService.getInvoiceUrl', () => {
  it('(paddle, transactionId) 로 조회해 소유자의 done 주문이면 URL 을 준다', async () => {
    const { service, prisma, paddle } = makeService(null, { userId: USER_A, status: 'done' });
    await expect(service.getInvoiceUrl(USER_A, 'txn_1')).resolves.toEqual({ url: 'https://invoice' });
    expect((prisma.subscriptionOrder.findUnique as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({
      provider_providerTransactionId: { provider: 'paddle', providerTransactionId: 'txn_1' },
    });
    expect(paddle.getInvoiceUrl).toHaveBeenCalledWith('txn_1');
  });

  it('없거나 다른 사용자거나 done 이 아니면 404 (존재 여부 비노출)', async () => {
    await expect(makeService(null, null).service.getInvoiceUrl(USER_A, 'txn_x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(makeService(null, { userId: 'other', status: 'done' }).service.getInvoiceUrl(USER_A, 'txn_1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(makeService(null, { userId: USER_A, status: 'refunded' }).service.getInvoiceUrl(USER_A, 'txn_1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
