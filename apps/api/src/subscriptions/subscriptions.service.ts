import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanValue, UserSubscription } from '@prisma/generated/client';
import { PLAN_LIMITS, PLAN_PRICING, PlanLimits } from './plan.constants';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 구독 행 조회 (없으면 null = free 플랜)
   */
  async getSubscription(userId: string): Promise<UserSubscription | null> {
    return this.prisma.userSubscription.findUnique({ where: { userId } });
  }

  /**
   * 유효 플랜 판정
   * - 유료 플랜: status가 expired가 아니고 && 기간 내 (currentPeriodEnd null = 무기한)
   * - 그 외 전부 free
   */
  getEffectivePlanOf(subscription: UserSubscription | null): PlanValue {
    if (!subscription || subscription.plan === 'free') {
      return 'free';
    }
    if (subscription.status === 'expired') {
      return 'free';
    }
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd <= new Date()) {
      return 'free';
    }
    return subscription.plan;
  }

  async getEffectivePlan(userId: string): Promise<PlanValue> {
    const subscription = await this.getSubscription(userId);
    return this.getEffectivePlanOf(subscription);
  }

  async getEntitlements(userId: string): Promise<{ plan: PlanValue; limits: PlanLimits }> {
    const plan = await this.getEffectivePlan(userId);
    return { plan, limits: PLAN_LIMITS[plan] };
  }

  /**
   * 플랜 기반 스토리지 용량 (StorageQuotaService에서 사용)
   */
  async getStorageQuotaBytes(userId: string): Promise<number> {
    const plan = await this.getEffectivePlan(userId);
    return PLAN_LIMITS[plan].storageQuotaBytes;
  }

  /**
   * 계정의 한도 대상 학생 수 (소유한 전 조직 합산)
   * leave(그만둠) 상태는 이력 보존용이므로 카운트에서 제외
   */
  async countBillableStudents(userId: string): Promise<number> {
    return this.prisma.student.count({
      where: {
        deletedAt: null,
        status: { not: 'leave' },
        organization: { userId, deletedAt: null },
      },
    });
  }

  /**
   * 구독 페이지용 요약 (플랜 + 한도 + 사용량 + 플랜 비교표 + 결제 내역)
   */
  async getSummary(userId: string) {
    const subscription = await this.getSubscription(userId);
    const plan = this.getEffectivePlanOf(subscription);

    const [studentCount, quota, orders] = await Promise.all([
      this.countBillableStudents(userId),
      this.prisma.userStorageQuota.findUnique({
        where: { userId },
        select: { usedBytes: true },
      }),
      this.prisma.subscriptionOrder.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          orderId: true,
          amount: true,
          status: true,
          failReason: true,
          approvedAt: true,
          receiptUrl: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      plan,
      status: subscription?.status ?? 'active',
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      canceledAt: subscription?.canceledAt ?? null,
      cardCompany: subscription?.cardCompany ?? null,
      cardNumberMasked: subscription?.cardNumberMasked ?? null,
      orders,
      limits: PLAN_LIMITS[plan],
      usage: {
        studentCount,
        storageUsedBytes: Number(quota?.usedBytes ?? 0),
      },
      catalog: {
        free: PLAN_LIMITS.free,
        pro: { ...PLAN_LIMITS.pro, priceKrw: PLAN_PRICING.pro.monthlyPriceKrw },
      },
    };
  }
}
