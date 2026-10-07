import { PlanValue } from '@prisma/generated/client';

export interface PlanLimits {
  /** 계정당 등록 가능한 학생 수 — 소유한 전 조직 합산 (null = 무제한) */
  maxStudents: number | null;
  /** 스토리지 용량 (바이트) */
  storageQuotaBytes: number;
}

export const PLAN_LIMITS: Record<PlanValue, PlanLimits> = {
  free: {
    // TODO(billing): 결제 오픈 전 임시 완화 (원래 5명). Paddle 결제 활성화 시 5로 복원할 것
    maxStudents: 1000,
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
  /** 월 구독료 (원) — 표시용. 실제 청구액의 진실은 Paddle price 엔티티 (세금 포함가) */
  monthlyPriceKrw: number;
}

export const PLAN_PRICING: Record<PaidPlanValue, PlanPricing> = {
  pro: {
    monthlyPriceKrw: 6900,
  },
};

/**
 * provider 상품 식별자 → 유료 플랜 (스펙 §5.2-12)
 * mapping 은 환경변수로 구성한다 (sandbox/production 가격 id 가 다름).
 * 매핑에 없거나 productId 가 null 이면 pro 로 둔다 — 현재 유일한 유료 플랜이고,
 * 매핑 실수로 결제가 멈추면 안 된다. 호출부는 matched=false 를 경고 로그로 남긴다.
 */
export function resolvePlanByProductId(
  productId: string | null,
  mapping: Record<string, PaidPlanValue>,
): { plan: PaidPlanValue; matched: boolean } {
  const plan = productId ? mapping[productId] : undefined;
  return plan ? { plan, matched: true } : { plan: 'pro', matched: false };
}
