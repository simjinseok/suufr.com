import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { UserSubscription } from '@prisma/generated/client';
import { SubscriptionsBillingService } from './subscriptions-billing.service';
import { PaddleApiError, type PaddleClient } from './paddle.client';
import { SubscriptionsService } from './subscriptions.service';
import type { PrismaService } from '../prisma/prisma.service';

const USER_A = '11111111-1111-4111-8111-111111111111';
const future = new Date(Date.now() + 86_400_000);

function makeService(
  subscription: Partial<UserSubscription> | null,
  order: { userId: string; status: string } | null = null,
  options: { emailVerified?: boolean } = {},
) {
  const updateMany = vi.fn().mockResolvedValue({});
  const prisma = {
    userSubscription: { findUnique: vi.fn().mockResolvedValue(subscription), updateMany },
    subscriptionOrder: { findUnique: vi.fn().mockResolvedValue(order) },
    user: { findUnique: vi.fn().mockResolvedValue({ emailVerified: options.emailVerified ?? true }) },
  } as unknown as PrismaService;
  const createCheckoutTransaction = vi.fn().mockResolvedValue({ transactionId: 'txn_1' });
  const paddle = {
    cancelAtPeriodEnd: vi.fn().mockResolvedValue({}),
    removeScheduledChange: vi.fn().mockResolvedValue({}),
    getInvoiceUrl: vi.fn().mockResolvedValue('https://invoice'),
    createCheckoutTransaction,
  } as unknown as PaddleClient;
  const subscriptions = new SubscriptionsService(prisma);
  return { service: new SubscriptionsBillingService(prisma, paddle, subscriptions), prisma, paddle, updateMany, createCheckoutTransaction };
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
  it('paddle 활성 구독은 Paddle 에 해지 예약하고 로컬을 canceled 로, 해지 시각을 기록', async () => {
    const { service, paddle, updateMany } = makeService(paddleActive);
    await service.cancel(USER_A);
    expect(paddle.cancelAtPeriodEnd).toHaveBeenCalledWith('sub_1');
    expect(updateMany.mock.calls[0][0].data).toMatchObject({ status: 'canceled', canceledAt: expect.any(Date) });
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
    expect(await errorCodeOf(none.service.resume(USER_A))).toBe('SUBSCRIPTION_NOT_RESUMABLE');
  });

  it('paddle 이 아닌 구독은 구독 id 가 있어도 Paddle 을 호출하지 않는다', async () => {
    const active = makeService({ ...paddleActive, provider: 'manual', providerSubscriptionId: 'legacy_1' });
    expect(await errorCodeOf(active.service.cancel(USER_A))).toBe('SUBSCRIPTION_NOT_CANCELABLE');
    expect(active.paddle.cancelAtPeriodEnd).not.toHaveBeenCalled();
    const canceled = makeService({ ...paddleActive, provider: 'manual', providerSubscriptionId: 'legacy_1', status: 'canceled' });
    expect(await errorCodeOf(canceled.service.resume(USER_A))).toBe('SUBSCRIPTION_NOT_RESUMABLE');
    expect(canceled.paddle.removeScheduledChange).not.toHaveBeenCalled();
  });

  it('paddle canceled 구독은 재개할 수 있다', async () => {
    const { service, paddle, updateMany } = makeService({ ...paddleActive, status: 'canceled', canceledAt: new Date() });
    await service.resume(USER_A);
    expect(paddle.removeScheduledChange).toHaveBeenCalledWith('sub_1');
    expect(updateMany.mock.calls[0][0].data).toMatchObject({ status: 'active', canceledAt: null });
    expect(updateMany.mock.calls[0][0].where).toEqual({ userId: USER_A, provider: 'paddle', providerSubscriptionId: 'sub_1' });
  });
});

describe('SubscriptionsBillingService.cancel / resume — 상태·기간 가드와 Paddle 오류', () => {
  it('이미 해지 예약(canceled)·만료(expired)된 paddle 구독은 NOT_CANCELABLE, Paddle 호출 없음', async () => {
    for (const status of ['canceled', 'expired'] as const) {
      const { service, paddle, updateMany } = makeService({ ...paddleActive, status });
      expect(await errorCodeOf(service.cancel(USER_A))).toBe('SUBSCRIPTION_NOT_CANCELABLE');
      expect(paddle.cancelAtPeriodEnd).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    }
  });

  it('해지 예약 상태가 아니거나 기간이 끝난(또는 기간이 없는) paddle 구독은 NOT_RESUMABLE, Paddle 호출 없음', async () => {
    for (const row of [
      paddleActive,
      { ...paddleActive, status: 'canceled' as const, currentPeriodEnd: new Date(Date.now() - 1000) },
      { ...paddleActive, status: 'canceled' as const, currentPeriodEnd: null },
    ]) {
      const { service, paddle, updateMany } = makeService(row);
      expect(await errorCodeOf(service.resume(USER_A))).toBe('SUBSCRIPTION_NOT_RESUMABLE');
      expect(paddle.removeScheduledChange).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    }
  });

  it('Paddle API 오류는 SUBSCRIPTION_CANCEL_FAILED / RESUME_FAILED 로 바꾸고 로컬 상태는 그대로 둔다', async () => {
    const apiError = new PaddleApiError({ type: 'request_error', code: 'bad_request', detail: 'x', documentation_url: '' }, null);

    const canceling = makeService(paddleActive);
    (canceling.paddle.cancelAtPeriodEnd as ReturnType<typeof vi.fn>).mockRejectedValue(apiError);
    expect(await errorCodeOf(canceling.service.cancel(USER_A))).toBe('SUBSCRIPTION_CANCEL_FAILED');
    expect(canceling.updateMany).not.toHaveBeenCalled();

    const resuming = makeService({ ...paddleActive, status: 'canceled', canceledAt: new Date() });
    (resuming.paddle.removeScheduledChange as ReturnType<typeof vi.fn>).mockRejectedValue(apiError);
    expect(await errorCodeOf(resuming.service.resume(USER_A))).toBe('SUBSCRIPTION_RESUME_FAILED');
    expect(resuming.updateMany).not.toHaveBeenCalled();
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

  it('Paddle 인보이스 발급이 API 오류면 500 대신 404', async () => {
    const { service, paddle } = makeService(null, { userId: USER_A, status: 'done' });
    (paddle.getInvoiceUrl as ReturnType<typeof vi.fn>).mockRejectedValue(
      new PaddleApiError({ type: 'request_error', code: 'not_found', detail: 'x', documentation_url: '' }, null),
    );
    await expect(service.getInvoiceUrl(USER_A, 'txn_1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SubscriptionsBillingService.createCheckout — 결제 시작 가드', () => {
  it('인증된 free 계정은 Paddle 거래를 만들고 transactionId 를 돌려준다', async () => {
    const { service, createCheckoutTransaction } = makeService(null);
    await expect(service.createCheckout(USER_A)).resolves.toEqual({ transactionId: 'txn_1' });
    expect(createCheckoutTransaction).toHaveBeenCalledWith(USER_A);
  });

  it('이메일 미인증이면 EMAIL_NOT_VERIFIED, Paddle 호출 없음 (UI 우회 방어)', async () => {
    const { service, createCheckoutTransaction } = makeService(null, null, { emailVerified: false });
    expect(await errorCodeOf(service.createCheckout(USER_A))).toBe('EMAIL_NOT_VERIFIED');
    expect(createCheckoutTransaction).not.toHaveBeenCalled();
  });

  it('이미 유효한 pro(활성·해지예약·연체 유예·스토어·수동) 면 SUBSCRIPTION_ALREADY_ACTIVE', async () => {
    for (const row of [
      paddleActive,
      { ...paddleActive, status: 'canceled' as const },
      { ...paddleActive, status: 'past_due' as const, currentPeriodEnd: new Date(Date.now() - 1000), gracePeriodExpiresAt: future },
      { ...paddleActive, provider: 'apple' as const, providerSubscriptionId: 'O1' },
      { ...paddleActive, provider: 'manual' as const, providerSubscriptionId: null, currentPeriodEnd: null },
    ]) {
      const { service, createCheckoutTransaction } = makeService(row);
      expect(await errorCodeOf(service.createCheckout(USER_A))).toBe('SUBSCRIPTION_ALREADY_ACTIVE');
      expect(createCheckoutTransaction).not.toHaveBeenCalled();
    }
  });

  it('만료된 pro 행(expired 또는 기간·유예 모두 지남)은 다시 구독할 수 있다', async () => {
    const past = new Date(Date.now() - 86_400_000);
    for (const row of [
      { ...paddleActive, status: 'expired' as const },
      { ...paddleActive, status: 'past_due' as const, currentPeriodEnd: past, gracePeriodExpiresAt: past },
    ]) {
      const { service } = makeService(row);
      await expect(service.createCheckout(USER_A)).resolves.toEqual({ transactionId: 'txn_1' });
    }
  });

  it('미인증이면서 pro 여도 먼저 EMAIL_NOT_VERIFIED 를 돌려준다', async () => {
    const { service } = makeService(paddleActive, null, { emailVerified: false });
    expect(await errorCodeOf(service.createCheckout(USER_A))).toBe('EMAIL_NOT_VERIFIED');
  });

  it('Paddle API 오류는 CHECKOUT_CREATE_FAILED 로, 그 외 예외는 그대로 던진다', async () => {
    const failing = makeService(null);
    failing.createCheckoutTransaction.mockRejectedValue(
      new PaddleApiError({ type: 'request_error', code: 'bad_request', detail: 'x', documentation_url: '' }, null),
    );
    expect(await errorCodeOf(failing.service.createCheckout(USER_A))).toBe('CHECKOUT_CREATE_FAILED');

    const misconfigured = makeService(null);
    misconfigured.createCheckoutTransaction.mockRejectedValue(new Error('PADDLE_PRICE_ID_PRO is not configured'));
    await expect(misconfigured.service.createCheckout(USER_A)).rejects.toThrow('PADDLE_PRICE_ID_PRO is not configured');
  });
});
