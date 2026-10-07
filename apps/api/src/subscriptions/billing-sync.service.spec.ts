import type { UserSubscription } from '@prisma/generated/client';
import { BillingSyncService } from './billing-sync.service';
import { BillingSyncRejectedError, type BillingSubscriptionState, type BillingTransactionRecord } from './billing.types';
import { SubscriptionsService } from './subscriptions.service';
import type { PrismaService } from '../prisma/prisma.service';

const DAY = 86_400_000;
const now = new Date('2026-10-07T00:00:00Z');
const future = new Date(now.getTime() + 20 * DAY);
const past = new Date(now.getTime() - 10 * DAY);
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

// getEffectivePlanOf 가 실제 시계와 비교하므로 고정 — 아니면 2026-10-27 이후 '유효' 행이 전부 free 로 판정돼 가드 테스트가 뒤집힌다
beforeAll(() => vi.useFakeTimers({ now }));
afterAll(() => vi.useRealTimers());

type Row = UserSubscription;

function row(overrides: Partial<Row> & Pick<Row, 'userId' | 'provider'>): Row {
  return {
    plan: 'pro',
    status: 'active',
    currentPeriodStart: past,
    currentPeriodEnd: future,
    gracePeriodExpiresAt: null,
    canceledAt: null,
    billingIssueDetectedAt: null,
    periodType: 'normal',
    providerEnvironment: 'sandbox',
    providerCustomerId: 'ctm_1',
    providerSubscriptionId: 'sub_1',
    providerProductId: 'pri_pro',
    providerNextProductId: null,
    providerLastEventAt: past,
    createdAt: past,
    updatedAt: past,
    ...overrides,
  };
}

/** userId 또는 (provider, providerSubscriptionId) 로 찾는 in-memory tx mock */
function makeTx(rows: Row[], orders: Array<{ provider: string; providerTransactionId: string; status: string }> = []) {
  const findUnique = vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
    if (typeof where.userId === 'string') {
      return rows.find(r => r.userId === where.userId) ?? null;
    }
    const key = where.provider_providerSubscriptionId as { provider: string; providerSubscriptionId: string };
    return rows.find(r => r.provider === key.provider && r.providerSubscriptionId === key.providerSubscriptionId) ?? null;
  });
  const upsert = vi.fn().mockResolvedValue({});
  const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
  const orderFindUnique = vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
    const key = where.provider_providerTransactionId as { provider: string; providerTransactionId: string };
    return orders.find(o => o.provider === key.provider && o.providerTransactionId === key.providerTransactionId) ?? null;
  });
  const orderUpsert = vi.fn().mockResolvedValue({});
  const createMany = vi.fn().mockResolvedValue({ count: 1 });
  const executeRaw = vi.fn().mockResolvedValue(1);
  const tx = {
    $executeRaw: executeRaw,
    userSubscription: { findUnique, upsert, deleteMany },
    subscriptionOrder: { findUnique: orderFindUnique, upsert: orderUpsert },
    billingWebhookEvent: { createMany },
  };
  return { tx, upsert, del: deleteMany, orderUpsert, createMany, executeRaw };
}

function makeService(tx: unknown) {
  const prisma = {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
  } as unknown as PrismaService;
  return new BillingSyncService(prisma, new SubscriptionsService(prisma));
}

function state(overrides: Partial<BillingSubscriptionState> = {}): BillingSubscriptionState {
  return {
    provider: 'paddle',
    environment: 'sandbox',
    subscriptionId: 'sub_1',
    replacesSubscriptionId: null,
    customerId: 'ctm_1',
    productId: 'pri_pro',
    nextProductId: null,
    userId: USER_A,
    status: 'active',
    periodType: 'normal',
    currentPeriodStart: past,
    currentPeriodEnd: future,
    gracePeriodExpiresAt: null,
    canceledAt: null,
    occurredAt: now,
    ...overrides,
  };
}

describe('BillingSyncService.syncSubscription — 식별과 가드', () => {
  it('manual 행에 만료된(expired) 이벤트가 오면 덮어쓰지 않는다', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'manual', providerSubscriptionId: null, providerEnvironment: null, status: 'active', currentPeriodEnd: future })]);
    const ok = await makeService(tx).syncSubscription(tx as never, state({ status: 'expired', currentPeriodEnd: past }));
    expect(ok).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('행이 없고 userId 가 있으면 생성한다', async () => {
    const { tx, upsert } = makeTx([]);
    const ok = await makeService(tx).syncSubscription(tx as never, state());
    expect(ok).toBe(true);
    expect(upsert.mock.calls[0][0].create).toMatchObject({
      userId: USER_A, provider: 'paddle', providerSubscriptionId: 'sub_1', plan: 'pro', status: 'active',
      providerLastEventAt: now, providerEnvironment: 'sandbox', providerProductId: 'pri_pro',
    });
  });

  it('userId 도 기존 행도 없으면 false (영구 결함, 거부 아님)', async () => {
    const { tx, upsert } = makeTx([]);
    const ok = await makeService(tx).syncSubscription(tx as never, state({ userId: null }));
    expect(ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('userId 가 없어도 (provider, subscriptionId) 로 기존 행을 찾아 반영한다', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'paddle' })]);
    const ok = await makeService(tx).syncSubscription(tx as never, state({ userId: null, status: 'canceled' }));
    expect(ok).toBe(true);
    expect(upsert.mock.calls[0][0].where).toEqual({ userId: USER_A });
    expect(upsert.mock.calls[0][0].update.status).toBe('canceled');
  });

  it('환경 가드: 기존 행이 production 인데 sandbox 이벤트면 거부한다 (TestFlight)', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'apple', providerEnvironment: 'production', providerSubscriptionId: 'O1' })]);
    await expect(makeService(tx).syncSubscription(tx as never, state({ provider: 'apple', subscriptionId: 'O1', environment: 'sandbox' })))
      .rejects.toBeInstanceOf(BillingSyncRejectedError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('환경 가드: 기존 행의 environment 가 null(리네임 이전 데이터)이면 통과한다', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'paddle', providerEnvironment: null })]);
    await makeService(tx).syncSubscription(tx as never, state({ environment: 'production' }));
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('소유자 가드: 다른 사용자의 유효한 구독이면 거부한다', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'apple', providerSubscriptionId: 'O1' })]);
    await expect(makeService(tx).syncSubscription(tx as never, state({ provider: 'apple', subscriptionId: 'O1', userId: USER_B })))
      .rejects.toBeInstanceOf(BillingSyncRejectedError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('소유자 가드: 다른 사용자의 만료된 구독이면 옛 행을 지우고 새 사용자에게 이전한다 (Apple 재구독)', async () => {
    const { tx, upsert, del } = makeTx([row({ userId: USER_A, provider: 'apple', providerSubscriptionId: 'O1', status: 'expired', currentPeriodEnd: past })]);
    const ok = await makeService(tx).syncSubscription(tx as never, state({ provider: 'apple', subscriptionId: 'O1', userId: USER_B }));
    expect(ok).toBe(true);
    expect(del).toHaveBeenCalledWith({ where: { userId: USER_A, provider: 'apple', providerSubscriptionId: 'O1' } });
    expect(upsert.mock.calls[0][0].where).toEqual({ userId: USER_B });
    expect(upsert.mock.calls[0][0].create.canceledAt).toBeNull(); // 옛 행의 값 미승계
    // 삭제가 upsert 보다 먼저 (유니크 충돌 방지)
    expect(del.mock.invocationCallOrder[0]).toBeLessThan(upsert.mock.invocationCallOrder[0]);
  });

  it('다른 구독 충돌 가드: 사용자에게 유효한 다른 provider 구독이 있으면 거부한다', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'paddle' })]);
    await expect(makeService(tx).syncSubscription(tx as never, state({ provider: 'apple', subscriptionId: 'O1' })))
      .rejects.toBeInstanceOf(BillingSyncRejectedError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('다른 구독 충돌 가드: 같은 provider 의 다른 구독(이중 체크아웃)도 거부한다', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'paddle', providerSubscriptionId: 'sub_1' })]);
    await expect(makeService(tx).syncSubscription(tx as never, state({ subscriptionId: 'sub_2' })))
      .rejects.toBeInstanceOf(BillingSyncRejectedError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('다른 구독 충돌 가드: 기존 구독이 만료됐으면 덮어쓰고 이전 provider 값을 남기지 않는다', async () => {
    // 환경은 같다 (다르면 3단계 환경 가드가 먼저 거부한다 — 한 DB 는 한 환경)
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'paddle', status: 'expired', currentPeriodEnd: past, canceledAt: past, providerCustomerId: 'ctm_1' })]);
    await makeService(tx).syncSubscription(tx as never, state({ provider: 'apple', subscriptionId: 'O1', customerId: null }));
    const { update } = upsert.mock.calls[0][0];
    expect(update).toMatchObject({ provider: 'apple', providerSubscriptionId: 'O1', providerCustomerId: null, canceledAt: null, billingIssueDetectedAt: null });
  });

  it('다른 구독 충돌 가드: manual(수동 부여) 행은 유료 provider 가 덮어쓴다', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'manual', providerSubscriptionId: null, currentPeriodEnd: null, providerEnvironment: null })]);
    await makeService(tx).syncSubscription(tx as never, state());
    expect(upsert.mock.calls[0][0].update.provider).toBe('paddle');
  });

  it('Google 토큰 교체: replacesSubscriptionId 로 찾은 행은 같은 구독으로 보고 식별자를 갱신한다', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'google', providerSubscriptionId: 'T1', providerEnvironment: 'production' })]);
    await makeService(tx).syncSubscription(tx as never, state({ provider: 'google', subscriptionId: 'T2', replacesSubscriptionId: 'T1', userId: null, environment: 'production' }));
    expect(upsert.mock.calls[0][0].where).toEqual({ userId: USER_A });
    expect(upsert.mock.calls[0][0].update.providerSubscriptionId).toBe('T2');
  });
});

describe('BillingSyncService.syncSubscription — 순서·상태 규칙', () => {
  it('같은 구독의 더 오래된 이벤트는 스킵한다', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'paddle', providerLastEventAt: now })]);
    const ok = await makeService(tx).syncSubscription(tx as never, state({ occurredAt: past, status: 'canceled' }));
    expect(ok).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('같은 시각(ms 동일) 이벤트는 반영한다 (가드는 > 비교)', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'paddle', providerLastEventAt: now })]);
    await makeService(tx).syncSubscription(tx as never, state({ occurredAt: now }));
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('구독 식별자가 바뀌는 첫 이벤트에는 순서 가드를 적용하지 않는다', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'paddle', status: 'expired', currentPeriodEnd: past, providerLastEventAt: now })]);
    await makeService(tx).syncSubscription(tx as never, state({ subscriptionId: 'sub_2', occurredAt: past }));
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('status 가 null(미지원 상태)이면 반영하지 않고 true', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'paddle' })]);
    const ok = await makeService(tx).syncSubscription(tx as never, state({ status: null }));
    expect(ok).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('past_due 진입 시 billingIssueDetectedAt 을 기록하고 기존 값이 있으면 유지한다', async () => {
    const first = makeTx([row({ userId: USER_A, provider: 'paddle' })]);
    await makeService(first.tx).syncSubscription(first.tx as never, state({ status: 'past_due' }));
    expect(first.upsert.mock.calls[0][0].update.billingIssueDetectedAt).toEqual(now);

    const second = makeTx([row({ userId: USER_A, provider: 'paddle', status: 'past_due', billingIssueDetectedAt: past })]);
    await makeService(second.tx).syncSubscription(second.tx as never, state({ status: 'past_due' }));
    expect(second.upsert.mock.calls[0][0].update.billingIssueDetectedAt).toEqual(past);
  });

  it('past_due 에서 active 로 복구되면 billingIssueDetectedAt 과 gracePeriodExpiresAt 을 비운다', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'paddle', status: 'past_due', billingIssueDetectedAt: past, gracePeriodExpiresAt: future })]);
    await makeService(tx).syncSubscription(tx as never, state({ status: 'active', gracePeriodExpiresAt: null }));
    expect(upsert.mock.calls[0][0].update).toMatchObject({ billingIssueDetectedAt: null, gracePeriodExpiresAt: null });
  });

  it('canceledAt: canceled 는 기존 값 ?? occurredAt, expired 는 state.canceledAt 우선, 그 외 null', async () => {
    const a = makeTx([row({ userId: USER_A, provider: 'paddle' })]);
    await makeService(a.tx).syncSubscription(a.tx as never, state({ status: 'canceled' }));
    expect(a.upsert.mock.calls[0][0].update.canceledAt).toEqual(now);

    const b = makeTx([row({ userId: USER_A, provider: 'paddle', status: 'canceled', canceledAt: past })]);
    const ended = new Date(now.getTime() - DAY);
    await makeService(b.tx).syncSubscription(b.tx as never, state({ status: 'expired', canceledAt: ended }));
    expect(b.upsert.mock.calls[0][0].update.canceledAt).toEqual(ended);

    const c = makeTx([row({ userId: USER_A, provider: 'paddle', status: 'canceled', canceledAt: past })]);
    await makeService(c.tx).syncSubscription(c.tx as never, state({ status: 'active' }));
    expect(c.upsert.mock.calls[0][0].update.canceledAt).toBeNull();
  });

  it('기간이 null 인 종결 이벤트(Paddle subscription.canceled)는 기존 기간을 보존한다', async () => {
    const { tx, upsert } = makeTx([row({ userId: USER_A, provider: 'paddle', currentPeriodStart: past, currentPeriodEnd: future })]);
    await makeService(tx).syncSubscription(tx as never, state({ status: 'expired', currentPeriodStart: null, currentPeriodEnd: null }));
    expect(upsert.mock.calls[0][0].update).toMatchObject({ currentPeriodStart: past, currentPeriodEnd: future });
  });

  it('productId 와 무관하게 plan 은 pro 이고 providerProductId 는 그대로 저장된다', async () => {
    const { tx, upsert } = makeTx([]);
    await makeService(tx).syncSubscription(tx as never, state({ productId: 'pri_unknown' }));
    const create = upsert.mock.calls[0][0].create;
    expect(create.plan).toBe('pro');
    expect(create.providerProductId).toBe('pri_unknown');
  });
});

describe('BillingSyncService.recordTransaction', () => {
  const record = (overrides: Partial<BillingTransactionRecord> = {}): BillingTransactionRecord => ({
    provider: 'paddle', environment: 'sandbox', transactionId: 'txn_1', subscriptionId: 'sub_1', userId: USER_A,
    amount: 6900, currency: 'KRW', periodType: 'normal', periodStart: past, periodEnd: future,
    status: 'done', failReason: null, approvedAt: now, occurredAt: now, ...overrides,
  });

  it('구독 행이 아직 없어도 userId 가 있으면 주문을 기록한다 (transaction.completed 선착)', async () => {
    const { tx, orderUpsert } = makeTx([]);
    expect(await makeService(tx).recordTransaction(tx as never, record())).toBe(true);
    expect(orderUpsert.mock.calls[0][0].create).toMatchObject({ userId: USER_A, provider: 'paddle', providerTransactionId: 'txn_1', amount: 6900, currency: 'KRW', status: 'done' });
  });

  it('userId 가 없으면 (provider, subscriptionId) 행으로 식별하고, 그것도 없으면 false', async () => {
    const found = makeTx([row({ userId: USER_A, provider: 'paddle' })]);
    expect(await makeService(found.tx).recordTransaction(found.tx as never, record({ userId: null }))).toBe(true);
    expect(found.orderUpsert.mock.calls[0][0].create.userId).toBe(USER_A);

    const missing = makeTx([]);
    expect(await makeService(missing.tx).recordTransaction(missing.tx as never, record({ userId: null }))).toBe(false);
  });

  it('done 인 주문을 failed 로 되돌리지 않는다. failed → done 은 허용', async () => {
    const a = makeTx([], [{ provider: 'paddle', providerTransactionId: 'txn_1', status: 'done' }]);
    await makeService(a.tx).recordTransaction(a.tx as never, record({ status: 'failed', failReason: 'declined' }));
    expect(a.orderUpsert).not.toHaveBeenCalled();

    const b = makeTx([], [{ provider: 'paddle', providerTransactionId: 'txn_1', status: 'failed' }]);
    await makeService(b.tx).recordTransaction(b.tx as never, record({ status: 'done' }));
    expect(b.orderUpsert.mock.calls[0][0].update.status).toBe('done');
  });

  it('refunded 주문은 늦게 온 completed 재전송으로 되돌리지 않는다', async () => {
    const { tx, orderUpsert } = makeTx([], [{ provider: 'paddle', providerTransactionId: 'txn_1', status: 'refunded' }]);
    await makeService(tx).recordTransaction(tx as never, record({ status: 'done' }));
    expect(orderUpsert).not.toHaveBeenCalled();
  });
});

describe('BillingSyncService.withEventDedup', () => {
  const envelope = { provider: 'paddle' as const, eventId: 'evt_1', eventType: 'subscription.created', occurredAt: now, payload: { event_id: 'evt_1' } };

  it('처음 보는 이벤트는 기록하고 apply 를 실행한다', async () => {
    const { tx, createMany, executeRaw } = makeTx([]);
    const apply = vi.fn();
    expect(await makeService(tx).withEventDedup(envelope, USER_A, apply)).toBe('applied');
    expect(executeRaw.mock.invocationCallOrder[0]).toBeLessThan(createMany.mock.invocationCallOrder[0]);
    expect(createMany.mock.calls[0][0]).toMatchObject({ skipDuplicates: true, data: [{ provider: 'paddle', eventId: 'evt_1', payload: { event_id: 'evt_1' } }] });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('이미 기록된 이벤트(count 0)는 apply 없이 duplicate', async () => {
    const { tx, createMany } = makeTx([]);
    createMany.mockResolvedValue({ count: 0 });
    const apply = vi.fn();
    expect(await makeService(tx).withEventDedup(envelope, USER_A, apply)).toBe('duplicate');
    expect(apply).not.toHaveBeenCalled();
  });

  it('apply 가 BillingSyncRejectedError 를 던지면 rejected 를 반환하고 예외를 전파하지 않는다', async () => {
    const { tx } = makeTx([]);
    const apply = vi.fn().mockRejectedValue(new BillingSyncRejectedError('conflict'));
    expect(await makeService(tx).withEventDedup(envelope, USER_A, apply)).toBe('rejected');
  });

  it('그 외 예외는 그대로 전파한다 (5xx → provider 재시도)', async () => {
    const { tx } = makeTx([]);
    const apply = vi.fn().mockRejectedValue(new Error('db down'));
    await expect(makeService(tx).withEventDedup(envelope, USER_A, apply)).rejects.toThrow('db down');
  });
});
