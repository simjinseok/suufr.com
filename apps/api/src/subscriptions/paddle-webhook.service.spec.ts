import type { ConfigService } from '@nestjs/config';
import type { EventEntity, TransactionNotification } from '@paddle/paddle-node-sdk';
import { PaddleWebhookService, type PaddleSubscriptionLike } from './paddle-webhook.service';
import type { BillingSyncService } from './billing-sync.service';

const now = new Date('2026-10-07T00:00:00Z');
const USER_A = '11111111-1111-4111-8111-111111111111';

function makeServiceWithSync(env: string | undefined = 'sandbox') {
  const sync = { withEventDedup: vi.fn(), syncSubscription: vi.fn(), recordTransaction: vi.fn() };
  const config = { get: vi.fn((key: string) => (key === 'PADDLE_ENV' ? env : undefined)) } as unknown as ConfigService;
  return { service: new PaddleWebhookService(sync as unknown as BillingSyncService, config), sync };
}

function makeService(env: string | undefined = 'sandbox') {
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
    customData: { userId: USER_A },
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

  it('PADDLE_ENV 가 production 이 아니면 sandbox', () => {
    expect(makeService(undefined).toSubscriptionState(subscription(), now).environment).toBe('sandbox');
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
    expect(makeService().toSubscriptionState(subscription({ customData: { userId: 'nope' } }), now).userId).toBeNull();
    expect(makeService().toSubscriptionState(subscription({ customData: null }), now).userId).toBeNull();
  });

  it('productId 는 recurring 인 첫 item 의 price.id, 없으면 null', () => {
    const s = makeService();
    expect(s.toSubscriptionState(subscription({ items: [{ recurring: false, price: { id: 'pri_once' } }, { recurring: true, price: { id: 'pri_pro' } }] }), now).productId).toBe('pri_pro');
    expect(s.toSubscriptionState(subscription({ items: [] }), now).productId).toBeNull();
  });
});

describe('PaddleWebhookService.toTransactionRecord', () => {
  const transaction = (overrides: Partial<TransactionNotification> = {}) => ({
    id: 'txn_1',
    subscriptionId: 'sub_1',
    customData: { userId: USER_A },
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
      transaction({ payments: [{ errorCode: 'declined' }, { errorCode: null }, { errorCode: 'insufficient_funds' }] as never }),
      'failed',
      now,
    );
    expect(record).toMatchObject({ status: 'failed', failReason: 'insufficient_funds', approvedAt: null });
  });

  it('errorCode 가 하나도 없는 실패는 unknown, billedAt 이 없는 완료는 occurredAt', () => {
    const s = makeService();
    expect(s.toTransactionRecord(transaction({ payments: [] }), 'failed', now)?.failReason).toBe('unknown');
    expect(s.toTransactionRecord(transaction({ billedAt: null }), 'done', now)?.approvedAt).toEqual(now);
  });

  it('금액이 정수가 아니면 null (재시도 무한 반복 방지)', () => {
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
      customData: { userId: USER_A },
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
      data: subscription({ customData: { userId: USER_A } }),
    } as unknown as EventEntity;
    await service.handleEvent(event, payload as never);
    expect(sync.withEventDedup.mock.calls[0][0].payload).toEqual(payload);
    expect(sync.withEventDedup.mock.calls[0][1]).toBe(USER_A);
  });
});
