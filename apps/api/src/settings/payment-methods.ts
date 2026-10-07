// 설정의 "기본 결제수단"으로 허용하는 값. Payment.method 자체는 자유 문자열이지만
// 설정값은 UI 선택지(계좌이체/카드/현금)와 같은 3종으로만 제한한다.
export const PAYMENT_METHODS = ['transfer', 'card', 'cash'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
