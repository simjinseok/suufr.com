import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleClient } from './paddle.client';
import { PaddleWebhookService } from './paddle-webhook.service';

// currentPeriodEnd 경과 후 이 시간이 지나도록 webhook이 안 왔으면 유실 의심
const RECONCILE_LAG_MS = 60 * 60 * 1000; // 1시간

/**
 * webhook 유실 대비 보정 크론
 * 청구는 Paddle이 수행하므로 여기서는 상태 동기화만 한다:
 * 기간이 끝났는데 로컬이 여전히 비종결 상태인 구독을 Paddle에서 다시 읽어 반영
 */
@Injectable()
export class SubscriptionsReconciliationService {
  private readonly logger = new Logger(SubscriptionsReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paddleClient: PaddleClient,
    private readonly webhookService: PaddleWebhookService,
  ) {}

  // 매일 오전 11시 실행 (KST) - UTC 02:00 = KST 11:00
  @Cron('0 2 * * *')
  async runReconciliationCycle() {
    const cutoff = new Date(Date.now() - RECONCILE_LAG_MS);

    const staleSubscriptions = await this.prisma.userSubscription.findMany({
      where: {
        plan: { not: 'free' },
        paddleSubscriptionId: { not: null },
        status: { in: ['active', 'canceled', 'past_due'] },
        currentPeriodEnd: { lt: cutoff },
      },
      select: { userId: true, paddleSubscriptionId: true },
    });

    if (staleSubscriptions.length === 0) {
      return;
    }

    this.logger.log(`Reconciling ${staleSubscriptions.length} stale subscription(s) with Paddle`);

    for (const subscription of staleSubscriptions) {
      if (!subscription.paddleSubscriptionId) {
        continue;
      }
      try {
        await this.reconcileOne(subscription.paddleSubscriptionId);
      }
      catch (error) {
        this.logger.error(`Failed to reconcile subscription for user ${subscription.userId}:`, error);
      }
    }
  }

  private async reconcileOne(paddleSubscriptionId: string) {
    const remote = await this.paddleClient.getSubscription(paddleSubscriptionId);

    // 조회 시점의 원격 상태가 곧 최신 진실 — occurredAt을 현재로 두어 이전 이벤트보다 우선 적용
    await this.prisma.$transaction(async (tx) => {
      await this.webhookService.syncSubscriptionState(tx, remote, new Date());
    });
  }
}
