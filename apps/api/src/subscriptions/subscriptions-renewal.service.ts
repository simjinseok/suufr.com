import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { TossClient, TossApiError } from './toss.client';
import { PLAN_PRICING, PaidPlanValue } from './plan.constants';
import { addOneMonth } from './subscriptions-billing.service';
import { UserSubscription } from '@prisma/generated/client';

// 결제 실패(past_due) 후 만료 처리까지의 유예 기간
const GRACE_PERIOD_DAYS = 7;

@Injectable()
export class SubscriptionsRenewalService {
  private readonly logger = new Logger(SubscriptionsRenewalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly tossClient: TossClient,
  ) {}

  // 매일 오전 10시 실행 (KST) - UTC 01:00 = KST 10:00
  @Cron('0 1 * * *')
  async runRenewalCycle() {
    this.logger.log('Starting subscription renewal cycle...');

    await this.expireOverdueSubscriptions();
    await this.renewDueSubscriptions();

    this.logger.log('Subscription renewal cycle completed');
  }

  /**
   * 만료 처리
   * - past_due: 기간 종료 + 유예(7일) 경과 → expired
   * - canceled: 기간 종료 → expired
   */
  private async expireOverdueSubscriptions() {
    const now = new Date();
    const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    const { count } = await this.prisma.userSubscription.updateMany({
      where: {
        plan: { not: 'free' },
        OR: [
          { status: 'past_due', currentPeriodEnd: { lt: graceCutoff } },
          { status: 'canceled', currentPeriodEnd: { lt: now } },
        ],
      },
      data: { status: 'expired' },
    });

    if (count > 0) {
      this.logger.log(`Expired ${count} subscription(s)`);
    }
  }

  /**
   * 갱신 청구: 기간이 끝난 active/past_due 구독에 자동결제
   * past_due는 유예 기간 동안 매일 재시도
   */
  private async renewDueSubscriptions() {
    const now = new Date();

    const dueSubscriptions = await this.prisma.userSubscription.findMany({
      where: {
        plan: { not: 'free' },
        status: { in: ['active', 'past_due'] },
        billingKey: { not: null },
        currentPeriodEnd: { lte: now },
      },
    });

    this.logger.log(`Found ${dueSubscriptions.length} subscription(s) due for renewal`);

    for (const subscription of dueSubscriptions) {
      try {
        await this.renewOne(subscription);
      }
      catch (error) {
        this.logger.error(`Failed to renew subscription for user ${subscription.userId}:`, error);
      }
    }
  }

  private async renewOne(subscription: UserSubscription) {
    const pricing = PLAN_PRICING[subscription.plan as PaidPlanValue];
    if (!pricing) {
      this.logger.error(`No pricing defined for plan '${subscription.plan}' (user ${subscription.userId})`);
      return;
    }

    const billingKey = this.cryptoService.decrypt(subscription.billingKey!);
    const orderId = `sub-${randomUUID()}`;

    try {
      const payment = await this.tossClient.chargeBilling(billingKey, {
        customerKey: subscription.userId,
        amount: pricing.monthlyPriceKrw,
        orderId,
        orderName: pricing.orderName,
      });

      // 주기 앵커 유지: 이전 종료일 기준 +1개월 (다운타임 등으로 과거면 현재 이후까지 연장)
      const previousEnd = subscription.currentPeriodEnd ?? new Date();
      let newEnd = addOneMonth(previousEnd);
      const now = new Date();
      while (newEnd <= now) {
        newEnd = addOneMonth(newEnd);
      }

      await this.prisma.$transaction([
        this.prisma.userSubscription.update({
          where: { userId: subscription.userId },
          data: {
            status: 'active',
            currentPeriodStart: previousEnd,
            currentPeriodEnd: newEnd,
          },
        }),
        this.prisma.subscriptionOrder.create({
          data: {
            userId: subscription.userId,
            orderId,
            paymentKey: payment.paymentKey,
            amount: payment.totalAmount,
            status: 'done',
            approvedAt: payment.approvedAt ? new Date(payment.approvedAt) : new Date(),
            receiptUrl: payment.receiptUrl,
          },
        }),
      ]);

      this.logger.log(`Renewed subscription for user ${subscription.userId} (until ${newEnd.toISOString()})`);
    }
    catch (error) {
      if (error instanceof TossApiError) {
        await this.prisma.$transaction([
          this.prisma.userSubscription.update({
            where: { userId: subscription.userId },
            data: { status: 'past_due' },
          }),
          this.prisma.subscriptionOrder.create({
            data: {
              userId: subscription.userId,
              orderId,
              amount: pricing.monthlyPriceKrw,
              status: 'failed',
              failReason: `${error.code}: ${error.message}`,
            },
          }),
        ]);
        this.logger.warn(`Renewal charge failed for user ${subscription.userId}: ${error.code}`);
        return;
      }
      throw error;
    }
  }
}
