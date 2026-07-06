import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationSubscription, PlanValue } from '@prisma/generated/client';
import { PLAN_LIMITS, PLAN_PRICING, PlanLimits } from './plan.constants';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 조직의 구독 행 조회 (없으면 null = free 플랜)
   */
  async getSubscription(organizationId: number): Promise<OrganizationSubscription | null> {
    return this.prisma.organizationSubscription.findUnique({ where: { organizationId } });
  }

  /**
   * 유효 플랜 판정
   * - 유료 플랜: status가 expired가 아니고 && 기간 내 (currentPeriodEnd null = 무기한)
   * - 그 외 전부 free
   */
  getEffectivePlanOf(subscription: OrganizationSubscription | null): PlanValue {
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

  async getEffectivePlan(organizationId: number): Promise<PlanValue> {
    const subscription = await this.getSubscription(organizationId);
    return this.getEffectivePlanOf(subscription);
  }

  async getEntitlements(organizationId: number): Promise<{ plan: PlanValue; limits: PlanLimits }> {
    const plan = await this.getEffectivePlan(organizationId);
    return { plan, limits: PLAN_LIMITS[plan] };
  }

  /**
   * 여러 조직의 플랜/한도 일괄 조회 (GET /api/auth/me 용)
   */
  async getEntitlementsForOrganizations(
    organizationIds: number[],
  ): Promise<Record<number, { plan: PlanValue; limits: PlanLimits }>> {
    if (organizationIds.length === 0) {
      return {};
    }

    const subscriptions = await this.prisma.organizationSubscription.findMany({
      where: { organizationId: { in: organizationIds } },
    });
    const byOrganizationId = new Map(subscriptions.map(s => [s.organizationId, s]));

    return Object.fromEntries(
      organizationIds.map((id) => {
        const plan = this.getEffectivePlanOf(byOrganizationId.get(id) ?? null);
        return [id, { plan, limits: PLAN_LIMITS[plan] }];
      }),
    );
  }

  /**
   * 사용자의 스토리지 용량 (StorageQuotaService에서 사용)
   * 파일은 사용자 소유이므로, 소유한 조직 중 가장 높은 플랜의 용량을 적용
   * (프로 조직이 하나라도 있으면 5GB)
   */
  async getStorageQuotaBytes(userId: string): Promise<number> {
    const subscriptions = await this.prisma.organizationSubscription.findMany({
      where: { organization: { userId, deletedAt: null } },
    });

    const quotas = subscriptions.map(
      subscription => PLAN_LIMITS[this.getEffectivePlanOf(subscription)].storageQuotaBytes,
    );

    return Math.max(PLAN_LIMITS.free.storageQuotaBytes, ...quotas);
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
   * 구독 페이지용 요약 (현재 조직의 플랜 + 한도 + 사용량 + 플랜 비교표 + 결제 내역)
   */
  async getSummary(userId: string, organizationUuid: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { uuid: organizationUuid, userId, deletedAt: null },
      select: { id: true },
    });

    if (!organization) {
      return null;
    }

    const subscription = await this.getSubscription(organization.id);
    const plan = this.getEffectivePlanOf(subscription);

    const [studentCount, storageQuotaBytes, quota, orders] = await Promise.all([
      this.countBillableStudents(organization.id),
      this.getStorageQuotaBytes(userId),
      this.prisma.userStorageQuota.findUnique({
        where: { userId },
        select: { usedBytes: true },
      }),
      this.prisma.subscriptionOrder.findMany({
        where: { organizationId: organization.id },
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
      // 학생 한도는 조직 플랜, 스토리지는 사용자 단위(소유 조직 최고 플랜) 기준
      limits: {
        maxStudents: PLAN_LIMITS[plan].maxStudents,
        storageQuotaBytes,
      },
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
