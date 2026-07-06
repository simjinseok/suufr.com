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

/** PRO 플랜 월 구독료 (원) */
export const PRO_PRICE_KRW = 6900;
