import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanValue, UserSubscription } from '@prisma/generated/client';
import { PLAN_LIMITS, PLAN_PRICING, PlanLimits } from './plan.constants';

/** 유효 플랜 판정에 필요한 최소 필드 (테스트·가드에서 부분 객체를 넘길 수 있게) */
export type EffectivePlanInput = Pick<UserSubscription, 'plan' | 'status' | 'currentPeriodEnd' | 'gracePeriodExpiresAt'>;

/** 구독을 지금 시작할 수 없는 사유. 비어 있으면 결제 시작 가능 */
export type SubscribeBlocker = 'email_unverified' | 'already_subscribed';

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
   * 유효 플랜 판정 (스펙 §4)
   * - 유료 플랜: status 가 expired 가 아니고 && 기간 내
   * - currentPeriodEnd null = 무기한 (grace 무시)
   * - 기간 끝 = max(currentPeriodEnd, gracePeriodExpiresAt) — 결제 실패 유예 중에는 접근 유지
   * - 그 외 전부 free
   */
  getEffectivePlanOf(subscription: EffectivePlanInput | null): PlanValue {
    if (!subscription || subscription.plan === 'free') {
      return 'free';
    }
    if (subscription.status === 'expired') {
      return 'free';
    }
    if (!subscription.currentPeriodEnd) {
      return subscription.plan;
    }
    const grace = subscription.gracePeriodExpiresAt;
    const end = grace && grace > subscription.currentPeriodEnd ? grace : subscription.currentPeriodEnd;
    if (end <= new Date()) {
      return 'free';
    }
    return subscription.plan;
  }

  async getEffectivePlan(userId: string): Promise<PlanValue> {
    const subscription = await this.getSubscription(userId);
    return this.getEffectivePlanOf(subscription);
  }

  /**
   * 구독 시작 차단 사유 (순수 함수 — 요약 응답과 체크아웃 가드가 같은 판정을 쓴다)
   * - email_unverified: 이메일 미인증 계정은 결제 불가. 미인증 계정 자동 정리 대상에 결제 계정이 섞이지 않게 하는 장치
   * - already_subscribed: 유효 플랜이 이미 유료
   */
  getSubscribeBlockers(input: { emailVerified: boolean; effectivePlan: PlanValue }): SubscribeBlocker[] {
    const blockers: SubscribeBlocker[] = [];
    if (!input.emailVerified) {
      blockers.push('email_unverified');
    }
    if (input.effectivePlan !== 'free') {
      blockers.push('already_subscribed');
    }
    return blockers;
  }

  /** User.emailVerified (행이 없으면 미인증으로 취급) */
  async isEmailVerified(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true } });
    return user?.emailVerified ?? false;
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
    const [subscription, studentCount, quota, orders, emailVerified] = await Promise.all([
      this.getSubscription(userId),
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
          provider: true,
          providerTransactionId: true,
          amount: true,
          currency: true,
          status: true,
          failReason: true,
          approvedAt: true,
          refundedAt: true,
          refundedAmount: true,
          createdAt: true,
        },
      }),
      this.isEmailVerified(userId),
    ]);
    const plan = this.getEffectivePlanOf(subscription);
    const subscribeBlockers = this.getSubscribeBlockers({ emailVerified, effectivePlan: plan });

    return {
      plan,
      status: subscription?.status ?? 'active',
      provider: subscription?.provider ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      gracePeriodExpiresAt: subscription?.gracePeriodExpiresAt ?? null,
      canceledAt: subscription?.canceledAt ?? null,
      billingIssueDetectedAt: subscription?.billingIssueDetectedAt ?? null,
      orders: orders.map(({ providerTransactionId, ...order }) => ({ ...order, transactionId: providerTransactionId })),
      canSubscribe: subscribeBlockers.length === 0,
      subscribeBlockers,
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
