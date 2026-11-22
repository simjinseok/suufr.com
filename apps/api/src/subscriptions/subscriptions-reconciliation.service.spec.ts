import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { ConfigService } from '@nestjs/config';
import type { Subscription, Transaction } from '@paddle/paddle-node-sdk';
import { SubscriptionsReconciliationService } from './subscriptions-reconciliation.service';
import { PaddleWebhookService } from './paddle-webhook.service';
import type { PaddleClient } from './paddle.client';
import type { BillingSyncService } from './billing-sync.service';
import type { PrismaService } from '../prisma/prisma.service';
import { BillingSyncRejectedError } from './billing.types';
import { buildCheckoutCustomData } from './checkout-custom-data';

vi.mock('@sentry/nestjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

const USER_A = '11111111-1111-4111-8111-111111111111';
const SECRET = 'whsec_test';
const SIGNED_A = buildCheckoutCustomData(USER_A, SECRET);
const TX = {
  tx: 'reconciliation-spec',
  $executeRaw: vi.fn(),
  // 반영 뒤 행 확인 — 기본은 행이 생긴 경우
  userSubscription: { findUnique: vi.fn() },
};

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

function build({ remotes, knownIds = [], deletedUserIds = [], aliveUserIds = [] }: {
  remotes: Subscription[];
  knownIds?: string[];
  /** account_deletions 행이 있는 사용자 */
  deletedUserIds?: string[];
  /** 그중 users 가 남아 있는(탈퇴 진행 중) 사용자 */
  aliveUserIds?: string[];
}) {
  const prisma = {
    userSubscription: {
      findMany: vi.fn().mockResolvedValue(knownIds.map(providerSubscriptionId => ({ providerSubscriptionId }))),
    },
    accountDeletion: {
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => (deletedUserIds.includes(where.userId) ? { userId: where.userId } : null)),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (deletedUserIds.includes(where.id) && !aliveUserIds.includes(where.id) ? null : { id: where.id })),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => fn(TX)),
  };
  const paddleClient = {
    listLiveSubscriptions: vi.fn().mockResolvedValue(remotes),
    listCompletedTransactions: vi.fn(async (subscriptionId: string) => [completedTransaction('txn_1', subscriptionId)]),
    cancelImmediately: vi.fn().mockResolvedValue({}),
    getSubscription: vi.fn().mockResolvedValue({ status: 'active' }),
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
    vi.mocked(Sentry.captureException).mockClear();
    vi.mocked(Sentry.captureMessage).mockClear();
    TX.userSubscription.findUnique.mockReset().mockResolvedValue({ userId: USER_A });
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
    // 반영 뒤 같은 트랜잭션에서 행을 확인하고, 웹훅 장애를 알리는 Sentry 경고를 남긴다
    expect(TX.userSubscription.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { provider_providerSubscriptionId: { provider: 'paddle', providerSubscriptionId: 'sub_lost' } },
    }));
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith('웹훅이 닿지 않은 Paddle 구독을 복구함', {
      level: 'warning',
      tags: { provider: 'paddle' },
      extra: { subscriptionId: 'sub_lost', userId: USER_A, transactionCount: 1 },
    });
  });

  it('반영 뒤에도 행이 없으면(수동 부여 유지 등) 복구 로그·Sentry 경고를 남기지 않는다', async () => {
    const { service, sync } = build({ remotes: [remoteSubscription('sub_lost')] });
    TX.userSubscription.findUnique.mockResolvedValue(null);
    await service.discoverMissingSubscriptions();
    expect(sync.syncSubscription).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(Logger.prototype.warn).not.toHaveBeenCalledWith(expect.stringContaining('Recovered'));
  });

  it('서명 없는 custom_data 의 구독은 반영하지 않는다 (웹훅의 뒷문 차단과 같은 기준)', async () => {
    const { service, paddleClient, prisma, sync } = build({ remotes: [remoteSubscription('sub_unsigned', { userId: USER_A })] });
    await service.discoverMissingSubscriptions();
    expect(paddleClient.listCompletedTransactions).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(sync.syncSubscription).not.toHaveBeenCalled();
  });

  it('탈퇴를 끝낸 계정의 누락 구독은 되살리지 않고 Paddle 에서 즉시 해지한다', async () => {
    const { service, paddleClient, prisma, sync } = build({ remotes: [remoteSubscription('sub_orphan')], deletedUserIds: [USER_A] });
    await service.discoverMissingSubscriptions();
    expect(paddleClient.cancelImmediately).toHaveBeenCalledWith('sub_orphan');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(sync.syncSubscription).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith('탈퇴한 계정에 남아 있던 Paddle 구독을 즉시 해지함', expect.objectContaining({
      extra: { subscriptionId: 'sub_orphan', userId: USER_A },
    }));
  });

  it('지운 계정의 구독 해지가 실패하면 fingerprint 로 Sentry 에 남긴다 (다음 시간에 재시도)', async () => {
    const { service, paddleClient } = build({ remotes: [remoteSubscription('sub_orphan')], deletedUserIds: [USER_A] });
    const error = new Error('paddle down');
    paddleClient.cancelImmediately.mockRejectedValue(error);
    await service.discoverMissingSubscriptions();
    expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.objectContaining({
      fingerprint: ['paddle-subscription-recovery-failed', 'sub_orphan'],
    }));
  });

  it('해지 요청이 거부됐어도 원격이 이미 canceled 면 실패로 보지 않는다', async () => {
    const { service, paddleClient } = build({ remotes: [remoteSubscription('sub_orphan')], deletedUserIds: [USER_A] });
    paddleClient.cancelImmediately.mockRejectedValue(new Error('already canceled'));
    paddleClient.getSubscription.mockResolvedValue({ status: 'canceled' });
    await service.discoverMissingSubscriptions();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('탈퇴 진행 중(users 남음)인 사용자의 구독은 해지하지 않는다 — 탈퇴가 실패하면 계정이 남으므로', async () => {
    const { service, paddleClient, sync } = build({ remotes: [remoteSubscription('sub_lost')], deletedUserIds: [USER_A], aliveUserIds: [USER_A] });
    await service.discoverMissingSubscriptions();
    expect(paddleClient.cancelImmediately).not.toHaveBeenCalled();
    // 반영은 syncSubscription 의 탈퇴 분기가 건너뛴다
    expect(sync.syncSubscription).toHaveBeenCalledTimes(1);
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

  it('복구 실패는 구독 id fingerprint 로 Sentry 에 보낸다 — 매시간 반복돼도 이슈 하나로 모인다', async () => {
    const { service, sync } = build({ remotes: [remoteSubscription('sub_1')] });
    const error = new BillingSyncRejectedError('conflict');
    sync.syncSubscription.mockRejectedValue(error);
    await service.discoverMissingSubscriptions();
    await service.discoverMissingSubscriptions();
    expect(Sentry.captureException).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(Sentry.captureException).mock.calls) {
      expect(call).toEqual([error, {
        fingerprint: ['paddle-subscription-recovery-failed', 'sub_1'],
        tags: { provider: 'paddle' },
        extra: { subscriptionId: 'sub_1' },
      }]);
    }
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
