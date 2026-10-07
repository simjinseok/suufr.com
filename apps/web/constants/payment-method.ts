// 설정의 "기본 결제수단" 허용값. Payment.method 자체는 서버에서 자유 문자열이지만
// 설정값과 UI 선택지는 이 3종으로만 다룬다. (API 쪽 동일 상수: apps/api/src/settings/payment-methods.ts)
export const PAYMENT_METHODS = ['transfer', 'card', 'cash'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'transfer';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transfer: '계좌이체',
  card: '카드',
  cash: '현금',
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHODS as readonly string[]).includes(value);
}

// 서버 값이 3종 밖이어도(과거 데이터·직접 API 호출) 폼이 빈 선택으로 깨지지 않게 transfer 로 폴백
export function normalizePaymentMethod(value: unknown): PaymentMethod {
  return isPaymentMethod(value) ? value : DEFAULT_PAYMENT_METHOD;
}
