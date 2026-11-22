import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Subscription, Transaction } from '@paddle/paddle-node-sdk';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleClient } from './paddle.client';
import { PaddleWebhookService } from './paddle-webhook.service';
import { BillingSyncService } from './billing-sync.service';

// currentPeriodEnd 경과 후 이 시간이 지나도록 webhook이 안 왔으면 유실 의심
const RECONCILE_LAG_MS = 60 * 60 * 1000; // 1시간

/**
 * webhook 유실 대비 보정 크론 (Paddle 전용. Apple·Google 보정은 각자 어댑터에서)
 * 청구는 Paddle이 수행하므로 여기서는 상태 동기화만 한다:
 * - 기간이 끝났는데 로컬이 여전히 비종결 상태인 구독을 Paddle에서 다시 읽어 반영 (매일)
 * - Paddle에는 살아 있는데 로컬에 행이 없는 구독을 찾아 반영 (매시간). 웹훅이 한 번도 닿지 않은 결제를 복구한다
 */
@Injectable()
export class SubscriptionsReconciliationService {
  private readonly logger = new Logger(SubscriptionsReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paddleClient: PaddleClient,
    private readonly paddleWebhookService: PaddleWebhookService,
    private readonly sync: BillingSyncService,
  ) {}

  // 매일 오전 11시 실행 (KST) - UTC 02:00 = KST 11:00
  @Cron('0 2 * * *', { timeZone: 'UTC' })
  async runReconciliationCycle() {
    const cutoff = new Date(Date.now() - RECONCILE_LAG_MS);

    const staleSubscriptions = await this.prisma.userSubscription.findMany({
      where: {
        provider: 'paddle',
        plan: { not: 'free' },
        providerSubscriptionId: { not: null },
        status: { in: ['active', 'canceled', 'past_due'] },
        currentPeriodEnd: { lt: cutoff },
      },
      select: { userId: true, providerSubscriptionId: true },
    });

    if (staleSubscriptions.length === 0) {
      return;
    }

    this.logger.log(`Reconciling ${staleSubscriptions.length} stale subscription(s) with Paddle`);

    for (const subscription of staleSubscriptions) {
      if (!subscription.providerSubscriptionId) {
        continue;
      }
      try {
        await this.reconcileOne(subscription.providerSubscriptionId);
      }
      catch (error) {
        this.logger.error(`Failed to reconcile subscription for user ${subscription.userId}:`, error);
      }
    }
  }

  private async reconcileOne(paddleSubscriptionId: string) {
    // 조회 전 시각을 기준으로 삼는다 — 조회 중 도착한 웹훅은 이보다 늦어 스킵되지 않고, 조회한 원격 상태는 이전 이벤트보다 우선한다
    const observedAt = new Date();
    const remote = await this.paddleClient.getSubscription(paddleSubscriptionId);

    // 거부(BillingSyncRejectedError)는 호출부 catch 에서 로그로 남는다
    const state = this.paddleWebhookService.toSubscriptionState(remote, observedAt);
    await this.prisma.$transaction(async (tx) => {
      // 같은 사용자의 웹훅과 동시에 처리되지 않게 잠근다
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${state.userId ?? `paddle:${state.subscriptionId}`}, 0))`;
      await this.sync.syncSubscription(tx, state);
    });
  }

  // 매시 30분 실행 — 결제했는데 웹훅이 닿지 않은 사용자가 최대 1시간 안에 PRO 를 받는다
  @Cron('30 * * * *', { timeZone: 'UTC' })
  async discoverMissingSubscriptions() {
    // 조회 전 시각을 기준으로 삼는다 (reconcileOne 과 같은 이유)
    const observedAt = new Date();
    const remotes = await this.paddleClient.listLiveSubscriptions();
    if (remotes.length === 0) {
      return;
    }

    const known = await this.prisma.userSubscription.findMany({
      where: { provider: 'paddle', providerSubscriptionId: { in: remotes.map(remote => remote.id) } },
      select: { providerSubscriptionId: true },
    });
    const knownIds = new Set(known.map(row => row.providerSubscriptionId));
    const missing = remotes.filter(remote => !knownIds.has(remote.id));

    for (const remote of missing) {
      try {
        await this.recoverOne(remote, observedAt);
      }
      catch (error) {
        this.logger.error(`Failed to recover missing paddle subscription ${remote.id}:`, error);
        // 해결될 때까지 매시간 실패하므로 fingerprint 를 구독 id 로 묶어 Sentry 이슈 하나로 모은다 (새 이슈일 때만 알림)
        Sentry.captureException(error, {
          fingerprint: ['paddle-subscription-recovery-failed', remote.id],
          tags: { provider: 'paddle' },
          extra: { subscriptionId: remote.id },
        });
      }
    }
  }

  /**
   * 로컬에 없는 구독을 반영하고 완료된 거래를 결제 내역에 채운다.
   * 사용자는 custom_data 서명으로만 식별한다 — 서명 없는 구독(Paddle.js 로 직접 연 체크아웃)은 웹훅과 마찬가지로 반영하지 않는다
   */
  private async recoverOne(remote: Subscription, observedAt: Date) {
    const state = this.paddleWebhookService.toSubscriptionState(remote, observedAt);
    const userId = state.userId;
    if (!userId) {
      this.logger.warn(`Skipping missing paddle subscription ${remote.id}: no signed custom_data.userId`);
      return;
    }
    const transactions: Transaction[] = await this.paddleClient.listCompletedTransactions(remote.id);

    // 거부(BillingSyncRejectedError)는 호출부 catch 에서 로그·Sentry 로 남는다
    const recovered = await this.prisma.$transaction(async (tx) => {
      // 같은 사용자의 웹훅과 동시에 처리되지 않게 잠근다
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
      await this.sync.syncSubscription(tx, state);
      for (const transaction of transactions) {
        const record = this.paddleWebhookService.toTransactionRecord(transaction, 'done', observedAt);
        if (record) {
          await this.sync.recordTransaction(tx, record);
        }
      }
      // 수동 부여 유지 등으로 syncSubscription 이 아무것도 바꾸지 않고 true 를 돌려줄 수 있다 — 행이 실제로 생겼는지 본다
      const row = await tx.userSubscription.findUnique({
        where: { provider_providerSubscriptionId: { provider: 'paddle', providerSubscriptionId: remote.id } },
        select: { userId: true },
      });
      return row !== null;
    }, {
      // BillingSyncService.withEventDedup 과 같은 이유 (Neon 깨어나는 시간)
      maxWait: 5000,
      timeout: 10000,
    });
    if (!recovered) {
      return;
    }
    this.logger.warn(`Recovered missing paddle subscription ${remote.id} for user ${userId} (${transactions.length} transaction(s))`);
    // 복구는 웹훅이 닿지 않았다는 뜻이다. 웹훅이 아예 오지 않으면 웹훅 쪽 Sentry 기록도 없으므로 여기서 알린다
    // (복구 뒤에도 해지·결제 실패·갱신은 웹훅에 의존한다)
    Sentry.captureMessage('웹훅이 닿지 않은 Paddle 구독을 복구함', {
      level: 'warning',
      tags: { provider: 'paddle' },
      extra: { subscriptionId: remote.id, userId, transactionCount: transactions.length },
    });
  }
}
