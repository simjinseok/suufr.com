import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { TossClient, TossApiError } from './toss.client';
import { PRO_PRICE_KRW } from './plan.constants';

export const PRO_ORDER_NAME = '스프 프로 월 구독';

/**
 * 다음 결제일 계산 (+1개월, 말일 보정: 1/31 → 2/28)
 */
export function addOneMonth(date: Date): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + 1);
  if (result.getDate() !== day) {
    result.setDate(0);
  }
  return result;
}

@Injectable()
export class SubscriptionsBillingService {
  private readonly logger = new Logger(SubscriptionsBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tossClient: TossClient,
    private readonly cryptoService: CryptoService,
  ) {}

  private newOrderId(): string {
    return `sub-${randomUUID()}`;
  }

  /**
   * 카드 등록(authKey) → 빌링키 발급 → 첫 결제 승인 → 프로 플랜 활성화
   * 첫 결제가 실패하면 아무것도 저장하지 않음 (카드 재등록 필요)
   */
  async activate(userId: string, authKey: string, customerEmail?: string) {
    let billing;
    try {
      billing = await this.tossClient.issueBillingKey(authKey, userId);
    }
    catch (error) {
      if (error instanceof TossApiError) {
        throw new BadRequestException({
          message: `카드 등록에 실패했어요. ${error.message}`,
          error: 'BILLING_KEY_ISSUE_FAILED',
        });
      }
      throw error;
    }

    const orderId = this.newOrderId();
    let payment;
    try {
      payment = await this.tossClient.chargeBilling(billing.billingKey, {
        customerKey: userId,
        amount: PRO_PRICE_KRW,
        orderId,
        orderName: PRO_ORDER_NAME,
        customerEmail,
      });
    }
    catch (error) {
      if (error instanceof TossApiError) {
        await this.prisma.subscriptionOrder.create({
          data: {
            userId,
            orderId,
            amount: PRO_PRICE_KRW,
            status: 'failed',
            failReason: `${error.code}: ${error.message}`,
          },
        });
        throw new BadRequestException({
          message: `결제에 실패했어요. ${error.message}`,
          error: 'BILLING_CHARGE_FAILED',
        });
      }
      throw error;
    }

    const now = new Date();
    const periodEnd = addOneMonth(now);
    const encryptedBillingKey = this.cryptoService.encrypt(billing.billingKey);

    await this.prisma.$transaction([
      this.prisma.userSubscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: 'pro',
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          billingKey: encryptedBillingKey,
          cardCompany: billing.cardCompany,
          cardNumberMasked: billing.cardNumber,
        },
        update: {
          plan: 'pro',
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          canceledAt: null,
          billingKey: encryptedBillingKey,
          cardCompany: billing.cardCompany,
          cardNumberMasked: billing.cardNumber,
        },
      }),
      this.prisma.subscriptionOrder.create({
        data: {
          userId,
          orderId,
          paymentKey: payment.paymentKey,
          amount: payment.totalAmount,
          status: 'done',
          approvedAt: payment.approvedAt ? new Date(payment.approvedAt) : now,
          receiptUrl: payment.receiptUrl,
        },
      }),
    ]);

    this.logger.log(`Subscription activated for user ${userId} (period end: ${periodEnd.toISOString()})`);
    return { success: true };
  }

  /**
   * 해지 예약: 기간 종료까지 프로 유지, 갱신만 중단
   */
  async cancel(userId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({ where: { userId } });

    if (!subscription || subscription.plan !== 'pro'
      || (subscription.status !== 'active' && subscription.status !== 'past_due')) {
      throw new BadRequestException({
        message: '해지할 수 있는 구독이 없습니다.',
        error: 'SUBSCRIPTION_NOT_CANCELABLE',
      });
    }

    await this.prisma.userSubscription.update({
      where: { userId },
      data: { status: 'canceled', canceledAt: new Date() },
    });

    return { success: true };
  }

  /**
   * 해지 취소: 기간이 남아 있으면 갱신을 재개
   */
  async resume(userId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({ where: { userId } });

    const now = new Date();
    if (!subscription || subscription.status !== 'canceled'
      || !subscription.currentPeriodEnd || subscription.currentPeriodEnd <= now) {
      throw new BadRequestException({
        message: '재개할 수 있는 구독이 없습니다.',
        error: 'SUBSCRIPTION_NOT_RESUMABLE',
      });
    }

    await this.prisma.userSubscription.update({
      where: { userId },
      data: { status: 'active', canceledAt: null },
    });

    return { success: true };
  }
}
