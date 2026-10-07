import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Prisma, UserSubscription } from '@prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';
import type { PaidPlanValue } from './plan.constants';
import {
  BillingSyncRejectedError,
  type BillingSubscriptionState,
  type BillingSyncOutcome,
  type BillingTransactionRecord,
  type BillingWebhookEnvelope,
} from './billing.types';

/**
 * provider 중립 구독 동기화 (스펙 §5.2, §5.4, §5.5)
 * Paddle·Apple·Google 어댑터는 페이로드를 BillingSubscriptionState / BillingTransactionRecord 로 바꿔 여기로 넘긴다.
 * 멱등성·가드·upsert 규칙은 전부 여기 한 곳에 있다.
 */
@Injectable()
export class BillingSyncService {
  private readonly logger = new Logger(BillingSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * 이벤트 기록(멱등성)과 상태 반영을 한 트랜잭션으로 처리
   * - (provider, eventId) 를 skipDuplicates 로 넣어 count 0 이면 이미 처리한 이벤트 → 스킵
   *   (Prisma 7 + adapter-pg 의 P2002 meta 에는 target 이 없어 예외로는 어느 유니크인지 알 수 없다)
   * - 거부(BillingSyncRejectedError)는 롤백 → 멱등 행이 남지 않아 provider 대시보드 재전송으로 복구 가능. Sentry 기록 후 정상 반환
   * - 그 외 예외는 전파 → 5xx → provider 재시도
   * @param lockKey 같은 사용자(모르면 같은 구독)의 이벤트가 동시에 처리되지 않게 잠그는 키
   */
  async withEventDedup(
    envelope: BillingWebhookEnvelope,
    lockKey: string,
    apply: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<BillingSyncOutcome> {
    try {
      return await this.prisma.$transaction(async (tx): Promise<BillingSyncOutcome> => {
        // 같은 키의 이벤트는 이 트랜잭션이 끝날 때까지 기다린다 (확인한 구독 상태가 처리 도중 다른 이벤트로 바뀌지 않게)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
        const { count } = await tx.billingWebhookEvent.createMany({
          data: [{
            provider: envelope.provider,
            eventId: envelope.eventId,
            eventType: envelope.eventType,
            occurredAt: envelope.occurredAt,
            payload: envelope.payload,
          }],
          skipDuplicates: true,
        });
        if (count === 0) {
          this.logger.log(`Skipping duplicate ${envelope.provider} event ${envelope.eventId}`);
          return 'duplicate';
        }
        await apply(tx);
        return 'applied';
      }, {
        // Neon 이 잠들었다 깨어날 때 연결에 2초 넘게 걸릴 수 있다. timeout 은 잠금 대기까지 포함
        maxWait: 5000,
        timeout: 10000,
      });
    }
    catch (error) {
      if (error instanceof BillingSyncRejectedError) {
        this.logger.error(`Rejected ${envelope.provider} event ${envelope.eventId} (${envelope.eventType}): ${error.message}`);
        Sentry.captureException(error, {
          tags: { provider: envelope.provider, eventType: envelope.eventType },
          extra: { eventId: envelope.eventId },
        });
        return 'rejected';
      }
      throw error;
    }
  }

  /**
   * 구독 상태를 UserSubscription 에 반영 (스펙 §5.2 의 12단계)
   * @returns false = 사용자를 식별할 수 없음 (영구 결함, 재시도 무의미). 거부는 BillingSyncRejectedError 로 던진다
   */
  async syncSubscription(tx: Prisma.TransactionClient, state: BillingSubscriptionState): Promise<boolean> {
    // 1. existing = (provider, subscriptionId) 행. Google 토큰 교체면 이전 토큰으로도 찾는다
    const bySubscriptionId = (providerSubscriptionId: string) => tx.userSubscription.findUnique({
      where: { provider_providerSubscriptionId: { provider: state.provider, providerSubscriptionId } },
    });
    let existing = await bySubscriptionId(state.subscriptionId);
    if (!existing && state.replacesSubscriptionId) {
      existing = await bySubscriptionId(state.replacesSubscriptionId);
    }

    // 2. 사용자 식별
    const userId = state.userId ?? existing?.userId ?? null;
    if (!userId) {
      return false;
    }
    let current: UserSubscription | null = existing ?? await tx.userSubscription.findUnique({ where: { userId } });

    // 3. 환경 가드 (TestFlight sandbox 구매가 production 행을 덮지 않게)
    if (current?.providerEnvironment && current.providerEnvironment !== state.environment) {
      throw new BillingSyncRejectedError(
        `environment mismatch for user ${userId}: row=${current.providerEnvironment} event=${state.environment} (${state.provider}/${state.subscriptionId})`,
      );
    }

    // 4. 소유자 가드: 한 스토어 계정의 구독이 두 suufr 계정에 붙으려는 경우
    let transferFrom: UserSubscription | null = null;
    if (existing && existing.userId !== userId) {
      if (this.subscriptionsService.getEffectivePlanOf(existing) !== 'free') {
        throw new BillingSyncRejectedError(
          `subscription ${state.provider}/${state.subscriptionId} belongs to user ${existing.userId} and is still effective; event is for ${userId}`,
        );
      }
      // 만료된 구독은 새 계정으로 이전 (삭제는 upsert 직전에)
      transferFrom = existing;
      current = await tx.userSubscription.findUnique({ where: { userId } });
    }

    const sameSubscription = current !== null
      && current.provider === state.provider
      && (current.providerSubscriptionId === state.subscriptionId
        || (state.replacesSubscriptionId !== null && current.providerSubscriptionId === state.replacesSubscriptionId));

    // 5. 다른 구독 충돌 가드 (manual 은 유효한 유료 이벤트에만 밀려난다)
    if (current && !sameSubscription && this.subscriptionsService.getEffectivePlanOf(current) !== 'free') {
      if (current.provider !== 'manual') {
        throw new BillingSyncRejectedError(
          `user ${userId} already has an effective subscription ${current.provider}/${current.providerSubscriptionId}; ignoring ${state.provider}/${state.subscriptionId}`,
        );
      }
      // 만료된 이벤트는 수동 부여를 덮어쓰지 않는다
      const incomingPlan = this.subscriptionsService.getEffectivePlanOf({
        plan: 'pro',
        status: state.status ?? 'expired',
        currentPeriodEnd: state.currentPeriodEnd,
        gracePeriodExpiresAt: state.gracePeriodExpiresAt,
      });
      if (incomingPlan === 'free') {
        this.logger.warn(`Ignoring expired ${state.provider}/${state.subscriptionId} event; manual grant of user ${userId} kept`);
        return true;
      }
      this.logger.warn(`Replacing manual grant of user ${userId} with ${state.provider}/${state.subscriptionId}`);
    }

    // 6. 순서 역전 가드 (같은 구독에만. provider 는 순서를 보장하지 않음)
    if (current && sameSubscription && current.providerLastEventAt && current.providerLastEventAt > state.occurredAt) {
      return true;
    }

    // 7. 미지원 상태
    if (!state.status) {
      this.logger.warn(`Ignoring unsupported ${state.provider} subscription state (${state.subscriptionId})`);
      return true;
    }

    // 8. 승계 값은 같은 구독일 때만
    const inherited = current && sameSubscription ? current : null;

    // 9~11. 파생 컬럼
    const billingIssueDetectedAt = state.status === 'past_due'
      ? inherited?.billingIssueDetectedAt ?? state.occurredAt
      : null;
    const canceledAt = state.status === 'canceled'
      ? inherited?.canceledAt ?? state.occurredAt
      : state.status === 'expired'
        ? state.canceledAt ?? inherited?.canceledAt ?? state.occurredAt
        : null;
    const currentPeriodStart = state.currentPeriodStart ?? inherited?.currentPeriodStart ?? null;
    const currentPeriodEnd = state.currentPeriodEnd ?? inherited?.currentPeriodEnd ?? null;

    // 12. upsert
    // 유료 플랜이 pro 하나라 상품 식별자와 무관하게 pro. 플랜이 늘면 state.productId → 플랜 매핑을 여기에 둔다 (providerProductId 는 그대로 저장된다)
    const plan: PaidPlanValue = 'pro';
    if (transferFrom) {
      // 그 사이 옛 사용자가 다른 구독을 시작했을 수 있어 구독 id 까지 맞춰 지운다
      await tx.userSubscription.deleteMany({
        where: { userId: transferFrom.userId, provider: transferFrom.provider, providerSubscriptionId: transferFrom.providerSubscriptionId },
      });
      this.logger.warn(`Transferred ${state.provider}/${state.subscriptionId} from user ${transferFrom.userId} to ${userId}`);
    }

    const data = {
      plan,
      status: state.status,
      currentPeriodStart,
      currentPeriodEnd,
      gracePeriodExpiresAt: state.gracePeriodExpiresAt,
      canceledAt,
      billingIssueDetectedAt,
      periodType: state.periodType,
      provider: state.provider,
      providerEnvironment: state.environment,
      providerCustomerId: state.customerId,
      providerSubscriptionId: state.subscriptionId,
      providerProductId: state.productId,
      providerNextProductId: state.nextProductId,
      providerLastEventAt: state.occurredAt,
    };
    await tx.userSubscription.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return true;
  }

  /**
   * 결제 시도 기록 (스펙 §5.4)
   * - (provider, transactionId) 기준 upsert. 같은 거래는 실패 후 성공(재시도)만 가능
   * - refunded 는 환불 핸들러만 바꾼다 (늦게 온 completed 재전송으로 되돌리지 않음)
   * @returns false = 사용자를 식별할 수 없음
   */
  async recordTransaction(tx: Prisma.TransactionClient, record: BillingTransactionRecord): Promise<boolean> {
    const userId = record.userId
      ?? (await tx.userSubscription.findUnique({
        where: { provider_providerSubscriptionId: { provider: record.provider, providerSubscriptionId: record.subscriptionId } },
        select: { userId: true },
      }))?.userId
      ?? null;
    if (!userId) {
      return false;
    }

    const key = { provider: record.provider, providerTransactionId: record.transactionId };
    const existing = await tx.subscriptionOrder.findUnique({
      where: { provider_providerTransactionId: key },
      select: { status: true },
    });
    if (existing?.status === 'refunded') {
      return true;
    }
    if (existing?.status === 'done' && record.status === 'failed') {
      return true;
    }

    const data = {
      providerEnvironment: record.environment,
      amount: record.amount,
      currency: record.currency,
      periodType: record.periodType,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      status: record.status,
      failReason: record.failReason,
      approvedAt: record.approvedAt,
    };
    await tx.subscriptionOrder.upsert({
      where: { provider_providerTransactionId: key },
      create: { userId, ...key, ...data },
      update: data,
    });
    return true;
  }
}
