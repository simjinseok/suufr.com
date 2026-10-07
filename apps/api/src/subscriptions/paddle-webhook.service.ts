import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventName,
  type EventEntity,
  type SubscriptionNotification,
  type TransactionNotification,
} from '@paddle/paddle-node-sdk';
import type { BillingEnvironmentValue, Prisma, SubscriptionStatusValue } from '@prisma/generated/client';
import { BillingSyncService } from './billing-sync.service';
import type { BillingSubscriptionState, BillingTransactionRecord, BillingWebhookEnvelope } from './billing.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * webhook(SubscriptionNotification)과 API(Subscription 엔티티) 양쪽이 만족하는 Paddle 구독의 구조적 최소 형태
 */
export interface PaddleSubscriptionLike {
  id: string;
  status: string;
  customerId: string;
  canceledAt: string | null;
  currentBillingPeriod: { startsAt: string; endsAt: string } | null;
  scheduledChange: { action: string } | null;
  customData: unknown;
  items: ReadonlyArray<{ recurring: boolean; price: { id: string } | null }>;
}

/**
 * Paddle 페이로드 → provider 중립 타입 변환 + 이벤트 라우팅 (스펙 §5.3)
 * 동기화 규칙은 BillingSyncService 에 있다. 여기는 Paddle 어휘를 중립 어휘로 바꾸기만 한다.
 */
@Injectable()
export class PaddleWebhookService {
  private readonly logger = new Logger(PaddleWebhookService.name);
  private readonly environment: BillingEnvironmentValue;

  constructor(
    private readonly sync: BillingSyncService,
    configService: ConfigService,
  ) {
    // PaddleClient 와 같은 판정
    this.environment = configService.get<string>('PADDLE_ENV') === 'production' ? 'production' : 'sandbox';
  }

  /**
   * @param payload raw body 를 JSON.parse 한 값 — 멱등 테이블에 원문으로 저장 (SDK 인스턴스가 아님)
   */
  async handleEvent(event: EventEntity, payload: Prisma.InputJsonValue): Promise<void> {
    const occurredAt = new Date(event.occurredAt);
    const envelope: BillingWebhookEnvelope = {
      provider: 'paddle',
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt,
      payload: this.redactPayload(payload),
    };

    switch (event.eventType) {
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionActivated:
      case EventName.SubscriptionUpdated:
      case EventName.SubscriptionCanceled:
      case EventName.SubscriptionPastDue:
      case EventName.SubscriptionResumed: {
        const state = this.toSubscriptionState(event.data as SubscriptionNotification, occurredAt);
        await this.sync.withEventDedup(envelope, async (tx) => {
          const applied = await this.sync.syncSubscription(tx, state);
          if (!applied) {
            this.logger.error(`Cannot resolve user for paddle subscription ${state.subscriptionId} (event ${event.eventId}, type ${event.eventType})`);
          }
        });
        return;
      }
      case EventName.TransactionCompleted:
      case EventName.TransactionPaymentFailed: {
        const status: 'done' | 'failed' = event.eventType === EventName.TransactionCompleted ? 'done' : 'failed';
        const record = this.toTransactionRecord(event.data as TransactionNotification, status, occurredAt);
        if (!record) {
          return; // 구독 청구가 아닌 거래(일회성 등)는 다루지 않음
        }
        await this.sync.withEventDedup(envelope, async (tx) => {
          const applied = await this.sync.recordTransaction(tx, record);
          if (!applied) {
            this.logger.error(`Cannot resolve user for paddle transaction ${record.transactionId} (event ${event.eventId}, type ${event.eventType})`);
          }
        });
        return;
      }
      default:
        this.logger.warn(`Unhandled paddle event type: ${event.eventType} (${event.eventId})`);
    }
  }

  /**
   * 원문 저장 전 결제수단 정보 제거 — 거래 원문의 data.payments[*].method_details 에는 카드 끝 4자리·만료월·
   * 카드소유자명이 들어 있다. 개인정보처리방침("결제수단 정보를 직접 수집·저장하지 않습니다")과 충돌하므로 저장하지 않는다.
   * 원본 객체는 변형하지 않고 얕은 복사본을 돌려준다.
   */
  private redactPayload(payload: Prisma.InputJsonValue): Prisma.InputJsonValue {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return payload;
    }
    const data = (payload as Record<string, unknown>).data;
    if (typeof data !== 'object' || data === null || !Array.isArray((data as Record<string, unknown>).payments)) {
      return payload;
    }
    const payments = ((data as Record<string, unknown>).payments as unknown[]).map((payment) => {
      if (typeof payment !== 'object' || payment === null) {
        return payment;
      }
      return Object.fromEntries(Object.entries(payment).filter(([key]) => key !== 'method_details'));
    });
    return { ...payload, data: { ...data, payments } } as Prisma.InputJsonValue;
  }

  toSubscriptionState(subscription: PaddleSubscriptionLike, occurredAt: Date): BillingSubscriptionState {
    const period = subscription.currentBillingPeriod;
    const recurringItem = subscription.items.find(item => item.recurring) ?? subscription.items[0];
    return {
      provider: 'paddle',
      environment: this.environment,
      subscriptionId: subscription.id,
      replacesSubscriptionId: null,
      customerId: subscription.customerId,
      productId: recurringItem?.price?.id ?? null,
      nextProductId: null,
      userId: this.extractUserId(subscription.customData),
      status: this.mapStatus(subscription),
      periodType: subscription.status === 'trialing' ? 'trial' : 'normal',
      currentPeriodStart: period ? new Date(period.startsAt) : null,
      currentPeriodEnd: period ? new Date(period.endsAt) : null,
      gracePeriodExpiresAt: null, // Paddle 에는 유예 개념이 없다 (dunning 중 past_due)
      canceledAt: subscription.canceledAt ? new Date(subscription.canceledAt) : null,
      occurredAt,
    };
  }

  toTransactionRecord(
    transaction: TransactionNotification,
    status: 'done' | 'failed',
    occurredAt: Date,
  ): BillingTransactionRecord | null {
    if (!transaction.subscriptionId) {
      return null;
    }
    const period = transaction.billingPeriod;
    return {
      provider: 'paddle',
      environment: this.environment,
      transactionId: transaction.id,
      subscriptionId: transaction.subscriptionId,
      userId: this.extractUserId(transaction.customData),
      // Paddle 금액은 이미 최소 단위 문자열 (KRW "6900")
      amount: Number.parseInt(transaction.details?.totals?.grandTotal ?? '0', 10),
      currency: transaction.currencyCode,
      periodType: 'normal', // 거래 페이로드만으로는 트라이얼 여부를 알 수 없고, 트라이얼을 쓰지 않는다
      periodStart: period ? new Date(period.startsAt) : null,
      periodEnd: period ? new Date(period.endsAt) : null,
      status,
      failReason: status === 'failed'
        ? [...transaction.payments].reverse().find(payment => payment.errorCode)?.errorCode ?? 'unknown'
        : null,
      approvedAt: status === 'done'
        ? (transaction.billedAt ? new Date(transaction.billedAt) : occurredAt)
        : null,
      occurredAt,
    };
  }

  /**
   * Paddle 구독 상태 → 로컬 status
   * - active/trialing + 해지 예약(scheduled_change cancel) = canceled (기간말까지 유료 유지)
   * - Paddle 의 canceled = 실제 종료, paused 도 접근 없음 → expired
   */
  private mapStatus(subscription: PaddleSubscriptionLike): SubscriptionStatusValue | null {
    switch (subscription.status) {
      case 'active':
      case 'trialing':
        return subscription.scheduledChange?.action === 'cancel' ? 'canceled' : 'active';
      case 'past_due':
        return 'past_due';
      case 'canceled':
      case 'paused':
        return 'expired';
      default:
        return null;
    }
  }

  private extractUserId(customData: unknown): string | null {
    const userId = (customData as { userId?: unknown } | null)?.userId;
    return typeof userId === 'string' && UUID_PATTERN.test(userId) ? userId : null;
  }
}
