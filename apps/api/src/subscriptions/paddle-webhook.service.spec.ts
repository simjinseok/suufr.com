import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EventEntity, TransactionNotification } from '@paddle/paddle-node-sdk';
import { PaddleWebhookService, type PaddleSubscriptionLike } from './paddle-webhook.service';
import type { BillingSyncService } from './billing-sync.service';
import type { BillingWebhookEnvelope } from './billing.types';
import { buildCheckoutCustomData } from './checkout-custom-data';

const now = new Date('2026-10-07T00:00:00Z');
const USER_A = '11111111-1111-4111-8111-111111111111';
const SECRET = 'whsec_test';
// 서버가 체크아웃 거래에 심는 형태 — 웹훅은 서명이 맞는 userId 만 믿는다
const SIGNED_A = buildCheckoutCustomData(USER_A, SECRET);

const TX = { tx: 'paddle-webhook-spec' };

// env 를 생략하면 PADDLE_ENV 미설정
function makeServiceWithSync(env?: string) {
  // withEventDedup 은 실제처럼 apply 콜백을 실행한다 — 이벤트가 어느 sync 메서드로 가는지까지 보이게
  const sync = {
    withEventDedup: vi.fn(async (_envelope: BillingWebhookEnvelope, _lockKey: string, apply: (tx: unknown) => Promise<void>) => {
      await apply(TX);
      return 'applied';
    }),
    syncSubscription: vi.fn().mockResolvedValue(true),
    recordTransaction: vi.fn().mockResolvedValue(true),
  };
  const config = {
    get: vi.fn((key: string) => (key === 'PADDLE_ENV' ? env : key === 'PADDLE_WEBHOOK_SECRET' ? SECRET : undefined)),
  } as unknown as ConfigService;
  return { service: new PaddleWebhookService(sync as unknown as BillingSyncService, config), sync };
}

function makeService(env?: string) {
  return makeServiceWithSync(env).service;
}

function subscription(overrides: Partial<PaddleSubscriptionLike> = {}): PaddleSubscriptionLike {
  return {
    id: 'sub_1',
    status: 'active',
    customerId: 'ctm_1',
    canceledAt: null,
    currentBillingPeriod: { startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-11-01T00:00:00Z' },
    scheduledChange: null,
    customData: SIGNED_A,
    items: [{ recurring: true, price: { id: 'pri_pro' } }],
    ...overrides,
  };
}

describe('PaddleWebhookService.toSubscriptionState', () => {
  it('active 구독을 중립 상태로 매핑한다 (환경은 PADDLE_ENV)', () => {
    const state = makeService('production').toSubscriptionState(subscription(), now);
    expect(state).toMatchObject({
      provider: 'paddle', environment: 'production', subscriptionId: 'sub_1', replacesSubscriptionId: null,
      customerId: 'ctm_1', productId: 'pri_pro', nextProductId: null, userId: USER_A,
      status: 'active', periodType: 'normal', gracePeriodExpiresAt: null, canceledAt: null, occurredAt: now,
    });
    expect(state.currentPeriodStart).toEqual(new Date('2026-10-01T00:00:00Z'));
    expect(state.currentPeriodEnd).toEqual(new Date('2026-11-01T00:00:00Z'));
  });

  it('PADDLE_ENV 가 없거나 production 이 아니면 sandbox', () => {
    expect(makeService().toSubscriptionState(subscription(), now).environment).toBe('sandbox');
    expect(makeService('staging').toSubscriptionState(subscription(), now).environment).toBe('sandbox');
  });

  it('상태 매핑: 해지 예약 → canceled, trialing → active/trial, past_due, canceled·paused → expired, 그 외 null', () => {
    const s = makeService();
    expect(s.toSubscriptionState(subscription({ scheduledChange: { action: 'cancel' } }), now).status).toBe('canceled');
    const trial = s.toSubscriptionState(subscription({ status: 'trialing' }), now);
    expect(trial.status).toBe('active');
    expect(trial.periodType).toBe('trial');
    expect(s.toSubscriptionState(subscription({ status: 'past_due' }), now).status).toBe('past_due');
    expect(s.toSubscriptionState(subscription({ status: 'canceled', canceledAt: '2026-10-05T00:00:00Z' }), now)).toMatchObject({
      status: 'expired', canceledAt: new Date('2026-10-05T00:00:00Z'),
    });
    expect(s.toSubscriptionState(subscription({ status: 'paused' }), now).status).toBe('expired');
    expect(s.toSubscriptionState(subscription({ status: 'weird' as never }), now).status).toBeNull();
  });

  it('기간이 null 인 종결 이벤트는 기간을 null 로 넘긴다 (보존은 sync 가 담당)', () => {
    const state = makeService().toSubscriptionState(subscription({ status: 'canceled', currentBillingPeriod: null }), now);
    expect(state.currentPeriodStart).toBeNull();
    expect(state.currentPeriodEnd).toBeNull();
  });

  it('customData.userId 가 uuid 가 아니면 userId null', () => {
    expect(makeService().toSubscriptionState(subscription({ customData: buildCheckoutCustomData('nope', SECRET) }), now).userId).toBeNull();
    expect(makeService().toSubscriptionState(subscription({ customData: null }), now).userId).toBeNull();
  });

  it('서명 없는 userId(클라이언트가 Paddle.js 로 직접 연 체크아웃)는 userId null — 뒷문 차단', () => {
    expect(makeService().toSubscriptionState(subscription({ customData: { userId: USER_A } }), now).userId).toBeNull();
  });

  it('서명이 다른 userId 로 바꿔치기된 customData 는 userId null', () => {
    expect(makeService().toSubscriptionState(subscription({ customData: { ...SIGNED_A, userId: '33333333-3333-4333-8333-333333333333' } }), now).userId).toBeNull();
  });

  it('productId 는 recurring 인 첫 item 의 price.id, recurring 이 없으면 첫 item, item 이 없으면 null', () => {
    const s = makeService();
    expect(s.toSubscriptionState(subscription({ items: [{ recurring: false, price: { id: 'pri_once' } }, { recurring: true, price: { id: 'pri_pro' } }] }), now).productId).toBe('pri_pro');
    expect(s.toSubscriptionState(subscription({ items: [{ recurring: false, price: { id: 'pri_once' } }] }), now).productId).toBe('pri_once');
    expect(s.toSubscriptionState(subscription({ items: [] }), now).productId).toBeNull();
  });
});

describe('PaddleWebhookService.toTransactionRecord', () => {
  const transaction = (overrides: Partial<TransactionNotification> = {}) => ({
    id: 'txn_1',
    subscriptionId: 'sub_1',
    customData: SIGNED_A,
    currencyCode: 'KRW',
    billedAt: '2026-10-01T00:00:10Z',
    billingPeriod: { startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-11-01T00:00:00Z' },
    details: { totals: { grandTotal: '6900' } },
    payments: [],
    ...overrides,
  }) as unknown as TransactionNotification;

  it('완료 거래를 최소 단위 금액·통화·기간과 함께 매핑한다', () => {
    const record = makeService().toTransactionRecord(transaction(), 'done', now);
    expect(record).toMatchObject({
      provider: 'paddle', environment: 'sandbox', transactionId: 'txn_1', subscriptionId: 'sub_1', userId: USER_A,
      amount: 6900, currency: 'KRW', periodType: 'normal', status: 'done', failReason: null,
      approvedAt: new Date('2026-10-01T00:00:10Z'),
    });
    expect(record?.periodStart).toEqual(new Date('2026-10-01T00:00:00Z'));
  });

  it('실패 거래는 마지막 errorCode 를 failReason 으로, approvedAt 은 null', () => {
    const record = makeService().toTransactionRecord(
      transaction({ payments: [{ errorCode: 'declined' }, { errorCode: null }, { errorCode: 'not_enough_balance' }] as never }),
      'failed',
      now,
    );
    expect(record).toMatchObject({ status: 'failed', failReason: 'not_enough_balance', approvedAt: null });
  });

  it('errorCode 가 하나도 없는 실패는 unknown, billedAt 이 없는 완료는 occurredAt', () => {
    const s = makeService();
    expect(s.toTransactionRecord(transaction({ payments: [] }), 'failed', now)?.failReason).toBe('unknown');
    expect(s.toTransactionRecord(transaction({ billedAt: null }), 'done', now)?.approvedAt).toEqual(now);
  });

  it('금액을 숫자로 읽을 수 없으면 null (재시도 무한 반복 방지)', () => {
    expect(makeService().toTransactionRecord(transaction({ details: { totals: { grandTotal: 'abc' } } } as never), 'done', now)).toBeNull();
  });

  it('구독이 없는 일회성 거래는 null', () => {
    expect(makeService().toTransactionRecord(transaction({ subscriptionId: null }), 'done', now)).toBeNull();
  });
});

describe('PaddleWebhookService.handleEvent payload', () => {
  const transactionPayload = () => ({
    event_id: 'evt_1',
    event_type: 'transaction.completed',
    data: {
      id: 'txn_1',
      payments: [{
        status: 'captured',
        method_details: { type: 'card', card: { cardholder_name: 'HONG', last4: '4242', expiry_month: 1, expiry_year: 2030 } },
      }],
    },
  });
  const transactionEvent = () => ({
    eventId: 'evt_1',
    eventType: 'transaction.completed',
    occurredAt: '2026-10-07T00:00:00Z',
    data: {
      id: 'txn_1',
      subscriptionId: 'sub_1',
      customData: SIGNED_A,
      currencyCode: 'KRW',
      billedAt: '2026-10-01T00:00:10Z',
      billingPeriod: null,
      details: { totals: { grandTotal: '6900' } },
      payments: [],
    },
  }) as unknown as EventEntity;

  it('거래 원문 저장 전에 payments[*].method_details 를 제거하고 원본은 변형하지 않는다', async () => {
    const { service, sync } = makeServiceWithSync();
    const payload = transactionPayload();
    await service.handleEvent(transactionEvent(), payload as never);
    const envelope = sync.withEventDedup.mock.calls[0][0];
    expect(sync.withEventDedup.mock.calls[0][1]).toBe(USER_A);
    expect(envelope.payload).not.toHaveProperty('data.payments.0.method_details');
    expect(envelope.payload).toHaveProperty('data.payments.0.status', 'captured');
    expect(envelope.payload).toHaveProperty('event_id', 'evt_1');
    expect(payload).toHaveProperty('data.payments.0.method_details');
  });

  it('payments 가 없는 구독 이벤트 원문은 그대로 저장한다', async () => {
    const { service, sync } = makeServiceWithSync();
    const payload = { event_id: 'evt_2', data: { id: 'sub_1', status: 'active' } };
    const event = {
      eventId: 'evt_2',
      eventType: 'subscription.updated',
      occurredAt: '2026-10-07T00:00:00Z',
      data: subscription({ customData: SIGNED_A }),
    } as unknown as EventEntity;
    await service.handleEvent(event, payload as never);
    expect(sync.withEventDedup.mock.calls[0][0].payload).toEqual(payload);
    expect(sync.withEventDedup.mock.calls[0][1]).toBe(USER_A);
  });
});

describe('PaddleWebhookService.handleEvent 라우팅', () => {
  afterEach(() => vi.restoreAllMocks());

  const occurredAt = '2026-10-07T00:00:00Z';
  const event = (eventType: string, data: unknown) => ({ eventId: 'evt_1', eventType, occurredAt, data }) as unknown as EventEntity;
  const transactionData = (overrides: Record<string, unknown> = {}) => ({
    id: 'txn_1',
    subscriptionId: 'sub_1',
    customData: SIGNED_A,
    currencyCode: 'KRW',
    billedAt: '2026-10-01T00:00:10Z',
    billingPeriod: null,
    details: { totals: { grandTotal: '6900' } },
    payments: [],
    ...overrides,
  });

  it.each([
    'subscription.created',
    'subscription.activated',
    'subscription.updated',
    'subscription.canceled',
    'subscription.past_due',
    'subscription.resumed',
  ])('%s 는 사용자 잠금 안에서 구독 상태로 동기화한다', async (eventType) => {
    const { service, sync } = makeServiceWithSync();
    await service.handleEvent(event(eventType, subscription()), {} as never);
    expect(sync.withEventDedup).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'paddle', eventId: 'evt_1', eventType, occurredAt: new Date(occurredAt) }),
      USER_A,
      expect.any(Function),
    );
    expect(sync.syncSubscription).toHaveBeenCalledWith(TX, expect.objectContaining({ subscriptionId: 'sub_1', userId: USER_A, occurredAt: new Date(occurredAt) }));
    expect(sync.recordTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['transaction.completed', 'done'],
    ['transaction.payment_failed', 'failed'],
  ])('%s 는 사용자 잠금 안에서 거래를 %s 로 기록한다', async (eventType, status) => {
    const { service, sync } = makeServiceWithSync();
    await service.handleEvent(event(eventType, transactionData()), {} as never);
    expect(sync.withEventDedup).toHaveBeenCalledWith(expect.objectContaining({ eventType }), USER_A, expect.any(Function));
    expect(sync.recordTransaction).toHaveBeenCalledWith(TX, expect.objectContaining({ transactionId: 'txn_1', subscriptionId: 'sub_1', userId: USER_A, status }));
    expect(sync.syncSubscription).not.toHaveBeenCalled();
  });

  it('다루지 않는 이벤트는 멱등 기록 없이 경고만 남긴다', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, sync } = makeServiceWithSync();
    await service.handleEvent(event('customer.created', { id: 'ctm_1' }), {} as never);
    expect(sync.withEventDedup).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('구독이 없는 일회성 거래는 멱등 기록 없이 건너뛴다', async () => {
    const { service, sync } = makeServiceWithSync();
    await expect(service.handleEvent(event('transaction.completed', transactionData({ subscriptionId: null })), {} as never)).resolves.toBeUndefined();
    expect(sync.withEventDedup).not.toHaveBeenCalled();
  });

  it('서명 없는 이벤트는 사용자 대신 구독 id 로 잠근다', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, sync } = makeServiceWithSync();
    const unsigned = { userId: USER_A };
    await service.handleEvent(event('subscription.updated', subscription({ customData: unsigned })), {} as never);
    await service.handleEvent(event('transaction.completed', transactionData({ customData: unsigned })), {} as never);
    expect(sync.withEventDedup.mock.calls.map(call => call[1])).toEqual(['paddle:sub_1', 'paddle:sub_1']);
    expect(sync.syncSubscription).toHaveBeenCalledWith(TX, expect.objectContaining({ userId: null }));
    expect(sync.recordTransaction).toHaveBeenCalledWith(TX, expect.objectContaining({ userId: null }));
  });

  it('사용자를 찾지 못해 반영하지 못하면 구독·거래 id 로 오류 로그를 남긴다', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, sync } = makeServiceWithSync();
    sync.syncSubscription.mockResolvedValue(false);
    sync.recordTransaction.mockResolvedValue(false);
    await service.handleEvent(event('subscription.updated', subscription()), {} as never);
    await service.handleEvent(event('transaction.completed', transactionData()), {} as never);
    expect(error).toHaveBeenCalledTimes(2);
    expect(error.mock.calls[0][0]).toContain('sub_1');
    expect(error.mock.calls[1][0]).toContain('txn_1');
  });
});
