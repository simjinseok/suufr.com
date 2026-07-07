import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TOSS_API_BASE = 'https://api.tosspayments.com';

/** 토스 API 에러 (실패 사유를 코드/메시지로 보존) */
export class TossApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'TossApiError';
  }
}

export interface TossBillingKeyResult {
  billingKey: string;
  customerKey: string;
  cardCompany: string | null;
  cardNumber: string | null;
}

export interface TossPaymentResult {
  paymentKey: string;
  orderId: string;
  status: string;
  approvedAt: string | null;
  totalAmount: number;
  receiptUrl: string | null;
}

@Injectable()
export class TossClient {
  private readonly logger = new Logger(TossClient.name);

  constructor(private readonly configService: ConfigService) {}

  private authHeader(): string {
    const secretKey = this.configService.get<string>('TOSS_SECRET_KEY');
    if (!secretKey) {
      throw new Error('TOSS_SECRET_KEY is not configured');
    }
    // 시크릿 키 뒤에 콜론을 붙여 base64 인코딩 (토스 Basic 인증 규격)
    return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${TOSS_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data: any = await response.json().catch(() => null);

    if (!response.ok) {
      const code = data?.code ?? 'UNKNOWN';
      const message = data?.message ?? `토스페이먼츠 API 오류 (HTTP ${response.status})`;
      this.logger.warn(`Toss API error on ${path}: ${code} ${message}`);
      throw new TossApiError(message, code, response.status);
    }

    return data as T;
  }

  /**
   * 카드 등록창에서 받은 authKey로 빌링키 발급
   * 발급된 빌링키는 다시 조회할 수 없으므로 즉시 저장해야 함
   */
  async issueBillingKey(authKey: string, customerKey: string): Promise<TossBillingKeyResult> {
    const data = await this.request<{
      billingKey: string;
      customerKey: string;
      cardCompany?: string;
      cardNumber?: string;
      card?: { number?: string };
    }>('/v1/billing/authorizations/issue', { authKey, customerKey });

    return {
      billingKey: data.billingKey,
      customerKey: data.customerKey,
      cardCompany: data.cardCompany ?? null,
      cardNumber: data.card?.number ?? data.cardNumber ?? null,
    };
  }

  /**
   * 빌링키로 자동결제 승인
   */
  async chargeBilling(
    billingKey: string,
    params: {
      customerKey: string;
      amount: number;
      orderId: string;
      orderName: string;
      customerEmail?: string;
    },
  ): Promise<TossPaymentResult> {
    const data = await this.request<{
      paymentKey: string;
      orderId: string;
      status: string;
      approvedAt?: string;
      totalAmount: number;
      receipt?: { url?: string };
    }>(`/v1/billing/${encodeURIComponent(billingKey)}`, params);

    return {
      paymentKey: data.paymentKey,
      orderId: data.orderId,
      status: data.status,
      approvedAt: data.approvedAt ?? null,
      totalAmount: data.totalAmount,
      receiptUrl: data.receipt?.url ?? null,
    };
  }
}
