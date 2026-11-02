import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Subscription, Transaction } from '@paddle/paddle-node-sdk';
import { SubscriptionsReconciliationService } from './subscriptions-reconciliation.service';
import { PaddleWebhookService } from './paddle-webhook.service';
import type { PaddleClient } from './paddle.client';
import type { BillingSyncService } from './billing-sync.service';
import type { PrismaService } from '../prisma/prisma.service';
import { BillingSyncRejectedError } from './billing.types';
import { buildCheckoutCustomData } from './checkout-custom-data';

const USER_A = '11111111-1111-4111-8111-111111111111';
const SECRET = 'whsec_test';
const SIGNED_A = buildCheckoutCustomData(USER_A, SECRET);
const TX = { tx: 'reconciliation-spec', $executeRaw: vi.fn() };

function remoteSubscription(id: string, customData: unknown = SIGNED_A) {
  return {
    id,
    status: 'active',
    customerId: 'ctm_1',
    canceledAt: null,
    currentBillingPeriod: { startsAt: '2026-11-02T00:00:00Z', endsAt: '2026-12-02T00:00:00Z' },
    scheduledChange: null,
    customData,
    items: [{ recurring: true, price: { id: 'pri_pro' } }],
  } as unknown as Subscription;
}

function completedTransaction(id: string, subscriptionId: string) {
  return {
    id,
    subscriptionId,
    customData: SIGNED_A,
    currencyCode: 'KRW',
    billedAt: '2026-11-02T00:00:10Z',
    billingPeriod: { startsAt: '2026-11-02T00:00:00Z', endsAt: '2026-12-02T00:00:00Z' },
    details: { totals: { grandTotal: '6900' } },
    payments: [],
  } as unknown as Transaction;
}

function build({ remotes, knownIds = [] }: { remotes: Subscription[]; knownIds?: string[] }) {
  const prisma = {
    userSubscription: {
      findMany: vi.fn().mockResolvedValue(knownIds.map(providerSubscriptionId => ({ providerSubscriptionId }))),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => fn(TX)),
  };
  const paddleClient = {
    listLiveSubscriptions: vi.fn().mockResolvedValue(remotes),
    listCompletedTransactions: vi.fn(async (subscriptionId: string) => [completedTransaction('txn_1', subscriptionId)]),
  };
  const sync = {
    syncSubscription: vi.fn().mockResolvedValue(true),
    recordTransaction: vi.fn().mockResolvedValue(true),
  };
  const config = {
    get: vi.fn((key: string) => (key === 'PADDLE_ENV' ? 'production' : key === 'PADDLE_WEBHOOK_SECRET' ? SECRET : undefined)),
  } as unknown as ConfigService;
  const webhook = new PaddleWebhookService(sync as unknown as BillingSyncService, config);
  const service = new SubscriptionsReconciliationService(
    prisma as unknown as PrismaService,
    paddleClient as unknown as PaddleClient,
    webhook,
    sync as unknown as BillingSyncService,
  );
  return { service, prisma, paddleClient, sync };
}

describe('SubscriptionsReconciliationService.discoverMissingSubscriptions', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('Paddle 에는 있는데 로컬 행이 없는 구독을 서명된 사용자로 반영하고 완료 거래를 결제 내역에 채운다', async () => {
    const { service, prisma, paddleClient, sync } = build({ remotes: [remoteSubscription('sub_known'), remoteSubscription('sub_lost')], knownIds: ['sub_known'] });
    await service.discoverMissingSubscriptions();

    expect(prisma.userSubscription.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { provider: 'paddle', providerSubscriptionId: { in: ['sub_known', 'sub_lost'] } },
    }));
    // 이미 있는 구독은 건드리지 않는다
    expect(paddleClient.listCompletedTransactions).toHaveBeenCalledTimes(1);
    expect(paddleClient.listCompletedTransactions).toHaveBeenCalledWith('sub_lost');
    expect(sync.syncSubscription).toHaveBeenCalledTimes(1);
    expect(sync.syncSubscription).toHaveBeenCalledWith(TX, expect.objectContaining({
      provider: 'paddle', environment: 'production', subscriptionId: 'sub_lost', userId: USER_A, status: 'active',
    }));
    expect(sync.recordTransaction).toHaveBeenCalledWith(TX, expect.objectContaining({
      transactionId: 'txn_1', subscriptionId: 'sub_lost', userId: USER_A, amount: 6900, currency: 'KRW', status: 'done',
    }));
    // 웹훅과 같은 사용자 잠금 안에서 처리
    expect(TX.$executeRaw).toHaveBeenCalled();
    expect(TX.$executeRaw.mock.calls.at(-1)).toContain(USER_A);
  });

  it('서명 없는 custom_data 의 구독은 반영하지 않는다 (웹훅의 뒷문 차단과 같은 기준)', async () => {
    const { service, paddleClient, prisma, sync } = build({ remotes: [remoteSubscription('sub_unsigned', { userId: USER_A })] });
    await service.discoverMissingSubscriptions();
    expect(paddleClient.listCompletedTransactions).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(sync.syncSubscription).not.toHaveBeenCalled();
  });

  it('살아 있는 구독이 없으면 DB 를 조회하지 않는다', async () => {
    const { service, prisma } = build({ remotes: [] });
    await service.discoverMissingSubscriptions();
    expect(prisma.userSubscription.findMany).not.toHaveBeenCalled();
  });

  it('한 구독이 거부돼도 나머지는 계속 처리한다', async () => {
    const { service, sync } = build({ remotes: [remoteSubscription('sub_1'), remoteSubscription('sub_2')] });
    sync.syncSubscription.mockRejectedValueOnce(new BillingSyncRejectedError('conflict'));
    await service.discoverMissingSubscriptions();
    expect(sync.syncSubscription.mock.calls.map(call => call[1].subscriptionId)).toEqual(['sub_1', 'sub_2']);
    expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('sub_1'), expect.any(BillingSyncRejectedError));
  });
});
