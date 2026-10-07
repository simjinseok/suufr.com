import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { UserSubscription } from '@prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleClient, PaddleApiError } from './paddle.client';
import { SubscriptionsService } from './subscriptions.service';

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
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * 프로 체크아웃 시작 — 서버가 Paddle 거래를 만들어 transactionId 를 돌려준다.
   * 미인증 계정은 결제할 수 없다(미인증 계정 자동 정리와 결제 계정이 섞이지 않게). 이미 유료면 이중 구독 방지.
   * 판정은 SubscriptionsService.getSubscribeBlockers 와 동일(요약 응답의 canSubscribe 와 어긋나지 않게).
   */
  async createCheckout(userId: string): Promise<{ transactionId: string }> {
    const [emailVerified, subscription] = await Promise.all([
      this.subscriptionsService.isEmailVerified(userId),
      this.prisma.userSubscription.findUnique({ where: { userId } }),
    ]);
    const blockers = this.subscriptionsService.getSubscribeBlockers({
      emailVerified,
      effectivePlan: this.subscriptionsService.getEffectivePlanOf(subscription),
    });

    if (blockers.includes('email_unverified')) {
      throw new BadRequestException({
        message: '이메일 인증을 마친 뒤 구독할 수 있어요. 설정에서 인증코드를 입력해주세요.',
        error: 'EMAIL_NOT_VERIFIED',
      });
    }
    if (blockers.includes('already_subscribed')) {
      throw new BadRequestException({
        message: '이미 프로 플랜을 이용 중이에요.',
        error: 'SUBSCRIPTION_ALREADY_ACTIVE',
      });
    }

    try {
      return await this.paddleClient.createCheckoutTransaction(userId);
    }
    catch (error) {
      if (error instanceof PaddleApiError) {
        this.logger.warn(`Paddle checkout transaction failed for user ${userId}: ${error.code} ${error.detail}`);
        throw new BadRequestException({
          message: '결제창을 준비하지 못했어요. 잠시 후 다시 시도해주세요.',
          error: 'CHECKOUT_CREATE_FAILED',
        });
      }
      throw error;
    }
  }

  /**
   * 스토어(App Store / Google Play) 구독은 서버가 해지·재개할 수 없다 — 스토어 구독 관리 화면에서만 가능
   */
  private assertNotStoreManaged(subscription: UserSubscription | null) {
    if (subscription && (subscription.provider === 'apple' || subscription.provider === 'google')) {
      throw new BadRequestException({
        message: '구독은 결제한 스토어에서 관리할 수 있어요.',
        error: 'SUBSCRIPTION_MANAGED_BY_STORE',
      });
    }
  }

  /**
   * 해지 예약: 기간 종료까지 유료 플랜 유지, 갱신만 중단
   */
  async cancel(userId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({ where: { userId } });
    this.assertNotStoreManaged(subscription);

    if (!subscription || subscription.plan === 'free' || subscription.provider !== 'paddle' || !subscription.providerSubscriptionId
      || (subscription.status !== 'active' && subscription.status !== 'past_due')) {
      throw new BadRequestException({
        message: '해지할 수 있는 구독이 없습니다.',
        error: 'SUBSCRIPTION_NOT_CANCELABLE',
      });
    }

    try {
      await this.paddleClient.cancelAtPeriodEnd(subscription.providerSubscriptionId);
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

    await this.prisma.userSubscription.updateMany({
      where: { userId, provider: 'paddle', providerSubscriptionId: subscription.providerSubscriptionId },
      data: { status: 'canceled', canceledAt: new Date() },
    });

    return { success: true };
  }

  /**
   * 해지 취소: 기간이 남아 있으면 예약된 해지(scheduled_change)를 제거해 갱신을 재개
   */
  async resume(userId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({ where: { userId } });
    this.assertNotStoreManaged(subscription);

    const now = new Date();
    if (!subscription || subscription.status !== 'canceled' || subscription.provider !== 'paddle' || !subscription.providerSubscriptionId
      || !subscription.currentPeriodEnd || subscription.currentPeriodEnd <= now) {
      throw new BadRequestException({
        message: '재개할 수 있는 구독이 없습니다.',
        error: 'SUBSCRIPTION_NOT_RESUMABLE',
      });
    }

    try {
      await this.paddleClient.removeScheduledChange(subscription.providerSubscriptionId);
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

    await this.prisma.userSubscription.updateMany({
      where: { userId, provider: 'paddle', providerSubscriptionId: subscription.providerSubscriptionId },
      data: { status: 'active', canceledAt: null },
    });

    return { success: true };
  }

  /**
   * 결제 내역의 인보이스 PDF URL 발급 (URL은 1시간 뒤 만료)
   */
  async getInvoiceUrl(userId: string, transactionId: string) {
    // 인보이스는 Paddle 거래만 발급된다 (스토어 영수증은 스토어가 발급)
    const order = await this.prisma.subscriptionOrder.findUnique({
      where: { provider_providerTransactionId: { provider: 'paddle', providerTransactionId: transactionId } },
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
      const url = await this.paddleClient.getInvoiceUrl(transactionId);
      return { url };
    }
    catch (error) {
      if (error instanceof PaddleApiError) {
        this.logger.warn(`Paddle invoice fetch failed for ${transactionId}: ${error.code} ${error.detail}`);
        throw new NotFoundException({
          message: '인보이스를 찾을 수 없습니다.',
          error: 'INVOICE_NOT_FOUND',
        });
      }
      throw error;
    }
  }
}
