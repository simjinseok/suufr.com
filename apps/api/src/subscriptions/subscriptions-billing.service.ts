import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleClient, PaddleApiError } from './paddle.client';

/**
 * 구독 해지/재개/인보이스 — Paddle API 호출 후 로컬 상태를 낙관 갱신
 * (최종 확정은 webhook의 subscription.updated가 담당)
 */
@Injectable()
export class SubscriptionsBillingService {
  private readonly logger = new Logger(SubscriptionsBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paddleClient: PaddleClient,
  ) {}

  /**
   * 해지 예약: 기간 종료까지 유료 플랜 유지, 갱신만 중단
   */
  async cancel(userId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({ where: { userId } });

    if (!subscription || subscription.plan === 'free' || !subscription.paddleSubscriptionId
      || (subscription.status !== 'active' && subscription.status !== 'past_due')) {
      throw new BadRequestException({
        message: '해지할 수 있는 구독이 없습니다.',
        error: 'SUBSCRIPTION_NOT_CANCELABLE',
      });
    }

    try {
      await this.paddleClient.cancelAtPeriodEnd(subscription.paddleSubscriptionId);
    }
    catch (error) {
      if (error instanceof PaddleApiError) {
        this.logger.warn(`Paddle cancel failed for user ${userId}: ${error.code} ${error.detail}`);
        throw new BadRequestException({
          message: '해지 요청에 실패했어요. 잠시 후 다시 시도해주세요.',
          error: 'SUBSCRIPTION_CANCEL_FAILED',
        });
      }
      throw error;
    }

    await this.prisma.userSubscription.update({
      where: { userId },
      data: { status: 'canceled', canceledAt: new Date() },
    });

    return { success: true };
  }

  /**
   * 해지 취소: 기간이 남아 있으면 예약된 해지(scheduled_change)를 제거해 갱신을 재개
   */
  async resume(userId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({ where: { userId } });

    const now = new Date();
    if (!subscription || subscription.status !== 'canceled' || !subscription.paddleSubscriptionId
      || !subscription.currentPeriodEnd || subscription.currentPeriodEnd <= now) {
      throw new BadRequestException({
        message: '재개할 수 있는 구독이 없습니다.',
        error: 'SUBSCRIPTION_NOT_RESUMABLE',
      });
    }

    try {
      await this.paddleClient.removeScheduledChange(subscription.paddleSubscriptionId);
    }
    catch (error) {
      if (error instanceof PaddleApiError) {
        this.logger.warn(`Paddle resume failed for user ${userId}: ${error.code} ${error.detail}`);
        throw new BadRequestException({
          message: '재개 요청에 실패했어요. 잠시 후 다시 시도해주세요.',
          error: 'SUBSCRIPTION_RESUME_FAILED',
        });
      }
      throw error;
    }

    await this.prisma.userSubscription.update({
      where: { userId },
      data: { status: 'active', canceledAt: null },
    });

    return { success: true };
  }

  /**
   * 결제 내역의 인보이스 PDF URL 발급 (URL은 1시간 뒤 만료)
   */
  async getInvoiceUrl(userId: string, paddleTransactionId: string) {
    const order = await this.prisma.subscriptionOrder.findUnique({
      where: { paddleTransactionId },
      select: { userId: true, status: true },
    });

    // 존재 여부를 노출하지 않도록 소유자 불일치도 동일하게 404
    if (!order || order.userId !== userId || order.status !== 'done') {
      throw new NotFoundException({
        message: '인보이스를 찾을 수 없습니다.',
        error: 'INVOICE_NOT_FOUND',
      });
    }

    try {
      const url = await this.paddleClient.getInvoiceUrl(paddleTransactionId);
      return { url };
    }
    catch (error) {
      if (error instanceof PaddleApiError) {
        this.logger.warn(`Paddle invoice fetch failed for ${paddleTransactionId}: ${error.code} ${error.detail}`);
        throw new NotFoundException({
          message: '인보이스를 찾을 수 없습니다.',
          error: 'INVOICE_NOT_FOUND',
        });
      }
      throw error;
    }
  }
}
