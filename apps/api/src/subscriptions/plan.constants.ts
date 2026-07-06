import { PlanValue } from '@prisma/generated/client';

export interface PlanLimits {
  /** 조직당 등록 가능한 학생 수 (null = 무제한) */
  maxStudents: number | null;
  /** 스토리지 용량 (바이트) */
  storageQuotaBytes: number;
}

export const PLAN_LIMITS: Record<PlanValue, PlanLimits> = {
  free: {
    maxStudents: 5,
    storageQuotaBytes: 104857600, // 100MB
  },
  pro: {
    maxStudents: null,
    storageQuotaBytes: 5368709120, // 5GB
  },
};

/** 결제가 필요한 플랜 (free 제외) */
export type PaidPlanValue = Exclude<PlanValue, 'free'>;

export interface PlanPricing {
  /** 월 구독료 (원) — 자동결제 청구 금액 */
  monthlyPriceKrw: number;
  /** 토스 주문명 */
  orderName: string;
}

export const PLAN_PRICING: Record<PaidPlanValue, PlanPricing> = {
  pro: {
    monthlyPriceKrw: 6900,
    orderName: '스프 프로 월 구독',
  },
};
