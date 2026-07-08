import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiError,
  Environment,
  NodeRuntime,
  Paddle,
  Webhooks,
  type EventEntity,
  type Subscription,
} from '@paddle/paddle-node-sdk';

export { ApiError as PaddleApiError };

/**
 * Paddle Billing SDK 래퍼
 * 청구/갱신/dunning은 Paddle이 수행하고, 여기서는 상태 조회와 해지/재개 요청만 보낸다
 */
@Injectable()
export class PaddleClient {
  private sdk: Paddle | null = null;

  constructor(private readonly configService: ConfigService) {
    // SDK crypto provider 등록 — Paddle 인스턴스 없이 Webhooks 서명 검증을 쓰기 위해 필요
    // (SDK는 new Paddle() 생성자에서만 이걸 호출한다)
    NodeRuntime.initialize();
  }

  private getSdk(): Paddle {
    if (!this.sdk) {
      const apiKey = this.configService.get<string>('PADDLE_API_KEY');
      if (!apiKey) {
        throw new Error('PADDLE_API_KEY is not configured');
      }
      const environment = this.configService.get<string>('PADDLE_ENV') === 'production'
        ? Environment.production
        : Environment.sandbox;
      this.sdk = new Paddle(apiKey, { environment });
    }
    return this.sdk;
  }

  /**
   * webhook 서명 검증 + 이벤트 파싱 (검증 실패 시 throw)
   * 순수 HMAC 검증이라 API 키가 필요 없으므로 SDK 인스턴스를 거치지 않는다
   */
  async unmarshal(rawBody: string, signature: string): Promise<EventEntity> {
    const secret = this.configService.get<string>('PADDLE_WEBHOOK_SECRET');
    if (!secret) {
      throw new Error('PADDLE_WEBHOOK_SECRET is not configured');
    }
    return new Webhooks().unmarshal(rawBody, secret, signature);
  }

  async getSubscription(paddleSubscriptionId: string): Promise<Subscription> {
    return this.getSdk().subscriptions.get(paddleSubscriptionId);
  }

  /**
   * 기간말 해지 예약 (기간 종료까지 유료 유지, scheduled_change 생성)
   */
  async cancelAtPeriodEnd(paddleSubscriptionId: string): Promise<Subscription> {
    return this.getSdk().subscriptions.cancel(paddleSubscriptionId, {
      effectiveFrom: 'next_billing_period',
    });
  }

  /**
   * 해지 예약 취소 (scheduled_change 제거 → 갱신 재개)
   */
  async removeScheduledChange(paddleSubscriptionId: string): Promise<Subscription> {
    return this.getSdk().subscriptions.update(paddleSubscriptionId, {
      scheduledChange: null,
    });
  }

  /**
   * 트랜잭션 인보이스 PDF URL (발급 후 1시간 만료라 저장하지 않고 온디맨드 발급)
   */
  async getInvoiceUrl(paddleTransactionId: string): Promise<string> {
    const invoice = await this.getSdk().transactions.getInvoicePDF(paddleTransactionId);
    return invoice.url;
  }
}
