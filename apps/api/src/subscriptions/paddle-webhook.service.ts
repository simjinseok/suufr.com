import { Injectable, Logger } from '@nestjs/common';
import {
  EventName,
  type EventEntity,
  type SubscriptionNotification,
  type TransactionNotification,
} from '@paddle/paddle-node-sdk';
import { Prisma, SubscriptionStatusValue } from '@prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * webhook/조회 API 양쪽에서 쓰는 Paddle 구독 상태의 구조적 최소 형태
 * (SubscriptionNotification과 Subscription 엔티티가 모두 만족)
 */
export interface PaddleSubscriptionState {
  id: string;
  status: string;
  customerId: string;
  canceledAt: string | null;
  currentBillingPeriod: { startsAt: string; endsAt: string } | null;
  scheduledChange: { action: string; effectiveAt: string } | null;
  customData: unknown;
}

@Injectable()
export class PaddleWebhookService {
  private readonly logger = new Logger(PaddleWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleEvent(event: EventEntity): Promise<void> {
    switch (event.eventType) {
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionActivated:
      case EventName.SubscriptionUpdated:
      case EventName.SubscriptionCanceled:
      case EventName.SubscriptionPastDue:
      case EventName.SubscriptionResumed:
        await this.applySubscriptionEvent(event, event.data as SubscriptionNotification);
        return;
      case EventName.TransactionCompleted:
        await this.applyTransactionEvent(event, event.data as TransactionNotification, 'done');
        return;
      case EventName.TransactionPaymentFailed:
        await this.applyTransactionEvent(event, event.data as TransactionNotification, 'failed');
        return;
      default:
        this.logger.warn(`Unhandled paddle event type: ${event.eventType} (${event.eventId})`);
    }
  }

  /**
   * Paddle 구독 상태 → 로컬 status 매핑
   * - active + 해지 예약(scheduled_change cancel) = canceled (기간말까지 유료 유지)
   * - Paddle의 canceled = 실제 종료이므로 expired
   * - paused/trialing은 사용하지 않음 (null 반환 시 호출부에서 스킵)
   */
  private mapStatus(state: PaddleSubscriptionState): SubscriptionStatusValue | null {
    switch (state.status) {
      case 'active':
        return state.scheduledChange?.action === 'cancel' ? 'canceled' : 'active';
      case 'past_due':
        return 'past_due';
      case 'canceled':
        return 'expired';
      default:
        return null;
    }
  }

  private extractUserId(customData: unknown): string | null {
    const userId = (customData as { userId?: unknown } | null)?.userId;
    return typeof userId === 'string' && UUID_PATTERN.test(userId) ? userId : null;
  }

  /**
   * 이벤트 기록(멱등성)과 상태 반영을 한 트랜잭션으로 처리
   * - event_id 중복(P2002) = 이미 처리한 이벤트 → 스킵
   * - 반영 실패 시 이벤트 기록도 롤백되므로 Paddle 재시도(5xx)로 복구 가능
   */
  private async withEventDedup(
    event: EventEntity,
    apply: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.paddleWebhookEvent.create({
          data: {
            eventId: event.eventId,
            eventType: event.eventType,
            occurredAt: new Date(event.occurredAt),
          },
        });
        await apply(tx);
      });
    }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.log(`Skipping duplicate paddle event ${event.eventId}`);
        return;
      }
      throw error;
    }
  }

  private async applySubscriptionEvent(event: EventEntity, data: SubscriptionNotification): Promise<void> {
    const occurredAt = new Date(event.occurredAt);

    await this.withEventDedup(event, async (tx) => {
      const applied = await this.syncSubscriptionState(tx, data, occurredAt);
      if (!applied) {
        this.logger.error(
          `Cannot resolve user for paddle subscription ${data.id} (event ${event.eventId}, type ${event.eventType})`,
        );
      }
    });
  }

  /**
   * Paddle 구독 상태를 UserSubscription에 멱등 반영
   * webhook과 reconciliation 크론이 공유하는 동기화 로직
   * @returns 반영 여부 (사용자를 못 찾으면 false — 영구 결함이라 재시도 무의미)
   */
  async syncSubscriptionState(
    tx: Prisma.TransactionClient,
    state: PaddleSubscriptionState,
    occurredAt: Date,
  ): Promise<boolean> {
    const existing = await tx.userSubscription.findUnique({
      where: { paddleSubscriptionId: state.id },
    });

    // customData.userId 우선, 없으면 기존 연결된 행으로 식별
    const userId = this.extractUserId(state.customData) ?? existing?.userId ?? null;
    if (!userId) {
      return false;
    }

    // 순서 역전 가드: 이미 더 최신 이벤트를 반영했으면 스킵 (Paddle은 순서를 보장하지 않음)
    const current = existing ?? await tx.userSubscription.findUnique({ where: { userId } });
    if (current?.paddleLastEventAt && current.paddleLastEventAt > occurredAt) {
      return true;
    }

    const status = this.mapStatus(state);
    if (!status) {
      this.logger.warn(`Ignoring unsupported paddle subscription status '${state.status}' (${state.id})`);
      return true;
    }

    const period = state.currentBillingPeriod;
    const canceledAt = status === 'canceled'
      ? current?.canceledAt ?? occurredAt
      : status === 'expired'
        ? (state.canceledAt ? new Date(state.canceledAt) : current?.canceledAt ?? occurredAt)
        : null;

    const common = {
      plan: 'pro' as const,
      status,
      canceledAt,
      paddleCustomerId: state.customerId,
      paddleSubscriptionId: state.id,
      paddleLastEventAt: occurredAt,
      ...(period && {
        currentPeriodStart: new Date(period.startsAt),
        currentPeriodEnd: new Date(period.endsAt),
      }),
    };

    await tx.userSubscription.upsert({
      where: { userId },
      create: {
        userId,
        currentPeriodStart: period ? new Date(period.startsAt) : null,
        currentPeriodEnd: period ? new Date(period.endsAt) : null,
        ...common,
      },
      update: common,
    });

    return true;
  }

  private async applyTransactionEvent(
    event: EventEntity,
    data: TransactionNotification,
    status: 'done' | 'failed',
  ): Promise<void> {
    // 구독 청구가 아닌 트랜잭션(일회성 등)은 다루지 않음
    const paddleSubscriptionId = data.subscriptionId;
    if (!paddleSubscriptionId) {
      return;
    }

    const occurredAt = new Date(event.occurredAt);

    await this.withEventDedup(event, async (tx) => {
      const userId = this.extractUserId(data.customData)
        ?? (await tx.userSubscription.findUnique({
          where: { paddleSubscriptionId },
          select: { userId: true },
        }))?.userId
        ?? null;

      if (!userId) {
        this.logger.error(
          `Cannot resolve user for paddle transaction ${data.id} (event ${event.eventId}, type ${event.eventType})`,
        );
        return;
      }

      const amount = Number.parseInt(data.details?.totals?.grandTotal ?? '0', 10);
      const failReason = status === 'failed'
        ? [...data.payments].reverse().find(payment => payment.errorCode)?.errorCode ?? 'unknown'
        : null;
      const approvedAt = status === 'done'
        ? (data.billedAt ? new Date(data.billedAt) : occurredAt)
        : null;

      const existing = await tx.subscriptionOrder.findUnique({
        where: { paddleTransactionId: data.id },
        select: { status: true },
      });

      // 같은 트랜잭션은 실패 후 성공(재시도)만 가능 — done을 failed로 되돌리지 않음
      if (existing?.status === 'done' && status === 'failed') {
        return;
      }

      await tx.subscriptionOrder.upsert({
        where: { paddleTransactionId: data.id },
        create: {
          userId,
          paddleTransactionId: data.id,
          amount,
          status,
          failReason,
          approvedAt,
        },
        update: { amount, status, failReason, approvedAt },
      });
    });
  }
}
