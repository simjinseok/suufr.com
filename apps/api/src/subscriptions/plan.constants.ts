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
