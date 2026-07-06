import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanValue, UserSubscription } from '@prisma/generated/client';
import { PLAN_LIMITS, PRO_PRICE_KRW, PlanLimits } from './plan.constants';

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
   * - pro: plan=pro && status가 expired가 아니고 && 기간 내 (currentPeriodEnd null = 무기한)
   * - 그 외 전부 free
   */
  getEffectivePlanOf(subscription: UserSubscription | null): PlanValue {
    if (!subscription || subscription.plan !== 'pro') {
      return 'free';
    }
    if (subscription.status === 'expired') {
      return 'free';
    }
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd <= new Date()) {
      return 'free';
    }
    return 'pro';
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
   * 조직의 한도 대상 학생 수
   * leave(그만둠) 상태는 이력 보존용이므로 카운트에서 제외
   */
  async countBillableStudents(organizationId: number): Promise<number> {
    return this.prisma.student.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { not: 'leave' },
      },
    });
  }

  /**
   * 구독 페이지용 요약 (플랜 + 한도 + 사용량 + 플랜 비교표)
   * studentCount는 organizationUuid로 지정한 조직 기준 (소유권 검증 포함)
   */
  async getSummary(userId: string, organizationUuid?: string) {
    const subscription = await this.getSubscription(userId);
    const plan = this.getEffectivePlanOf(subscription);

    let studentCount: number | null = null;
    if (organizationUuid) {
      const organization = await this.prisma.organization.findFirst({
        where: { uuid: organizationUuid, userId, deletedAt: null },
        select: { id: true },
      });
      if (organization) {
        studentCount = await this.countBillableStudents(organization.id);
      }
    }

    const quota = await this.prisma.userStorageQuota.findUnique({
      where: { userId },
      select: { usedBytes: true },
    });

    return {
      plan,
      status: subscription?.status ?? 'active',
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      canceledAt: subscription?.canceledAt ?? null,
      cardCompany: subscription?.cardCompany ?? null,
      cardNumberMasked: subscription?.cardNumberMasked ?? null,
      limits: PLAN_LIMITS[plan],
      usage: {
        studentCount,
        storageUsedBytes: Number(quota?.usedBytes ?? 0),
      },
      catalog: {
        free: PLAN_LIMITS.free,
        pro: { ...PLAN_LIMITS.pro, priceKrw: PRO_PRICE_KRW },
      },
    };
  }
}
