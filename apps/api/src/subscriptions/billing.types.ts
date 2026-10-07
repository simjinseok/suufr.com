import type {
  BillingEnvironmentValue,
  BillingPeriodTypeValue,
  BillingProviderValue,
  Prisma,
  SubscriptionStatusValue,
} from '@prisma/generated/client';

/**
 * provider 중립 구독 상태 (스펙 §5.1)
 * 웹훅·보정 크론이 provider 페이로드를 이 형태로 변환해 BillingSyncService 에 넘긴다.
 * Apple·Google 어댑터는 이 타입만 만들면 된다.
 */
export interface BillingSubscriptionState {
  provider: Exclude<BillingProviderValue, 'manual'>;
  environment: BillingEnvironmentValue;
  /** providerSubscriptionId: Paddle sub_…, Apple originalTransactionId, Google purchaseToken */
  subscriptionId: string;
  /** Google linkedPurchaseToken — 이 구독이 대체하는 이전 식별자. 가드는 둘을 같은 구독으로 본다 */
  replacesSubscriptionId: string | null;
  customerId: string | null;
  productId: string | null;
  nextProductId: string | null;
  /** provider 가 전달한 계정 매핑 (Paddle customData.userId, Apple appAccountToken, Google obfuscatedExternalAccountId). 없으면 기존 행으로 식별 */
  userId: string | null;
  /** null = 미지원 상태 → 스킵 */
  status: SubscriptionStatusValue | null;
  periodType: BillingPeriodTypeValue;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  gracePeriodExpiresAt: Date | null;
  /** expired 일 때 실제 종료 시각 (알면) */
  canceledAt: Date | null;
  /** 순서 역전 가드 기준. Paddle occurred_at, Apple signedDate, Google eventTimeMillis */
  occurredAt: Date;
}

/** provider 중립 결제 시도 기록 (스펙 §5.1). 구독 없는 일회성 거래는 어댑터가 스킵한다 */
export interface BillingTransactionRecord {
  provider: Exclude<BillingProviderValue, 'manual'>;
  environment: BillingEnvironmentValue;
  transactionId: string;
  subscriptionId: string;
  userId: string | null;
  /** 통화 최소 단위 정수 */
  amount: number;
  /** ISO 4217 */
  currency: string;
  periodType: BillingPeriodTypeValue;
  periodStart: Date | null;
  periodEnd: Date | null;
  status: 'done' | 'failed';
  failReason: string | null;
  approvedAt: Date | null;
  occurredAt: Date;
}

/** 멱등 테이블에 남기는 웹훅 봉투 (스펙 §3.4, §5.5) */
export interface BillingWebhookEnvelope {
  provider: Exclude<BillingProviderValue, 'manual'>;
  eventId: string;
  eventType: string;
  occurredAt: Date;
  /** raw body 를 JSON.parse 한 값 (SDK 클래스 인스턴스가 아님) */
  payload: Prisma.InputJsonValue;
}

/**
 * 동기화 거부 (스펙 §5.2 "거부의 정의")
 * 던지면 트랜잭션이 롤백되어 멱등 행이 남지 않고, 호출부는 Sentry 기록 후 200 을 반환한다.
 * 운영자가 원인을 정리한 뒤 provider 대시보드에서 같은 이벤트를 재전송하면 반영된다.
 */
export class BillingSyncRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillingSyncRejectedError';
  }
}

export type BillingSyncOutcome = 'applied' | 'duplicate' | 'rejected';
