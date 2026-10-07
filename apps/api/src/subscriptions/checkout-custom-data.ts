import { createHmac, timingSafeEqual } from 'crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 서버가 체크아웃 거래에 심는 custom data. Paddle 은 이 값을 거래→구독→웹훅 이벤트로 그대로 전달한다.
 * Paddle client token 과 price ID 는 공개값이라 클라이언트가 Paddle.js 로 체크아웃을 직접 열며 userId 를
 * 마음대로 적을 수 있다. 그래서 웹훅은 서버 비밀키(PADDLE_WEBHOOK_SECRET)로 만든 서명이 맞는 userId 만 믿는다.
 * 서명이 없거나 틀리면 이벤트는 사용자 미해석으로 버려진다(기존 구독은 BillingSyncService 가 저장된 행으로 식별).
 */
export interface CheckoutCustomData {
  userId: string;
  sig: string;
}

function sign(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(`checkout-user:${userId}`).digest('hex');
}

export function buildCheckoutCustomData(userId: string, secret: string): CheckoutCustomData {
  return { userId, sig: sign(userId, secret) };
}

/**
 * 웹훅 custom_data → 검증된 userId. 서명 불일치·형식 오류·비밀키 없음은 전부 null.
 */
export function verifyCheckoutCustomData(customData: unknown, secret: string | undefined): string | null {
  if (!secret || typeof customData !== 'object' || customData === null) {
    return null;
  }
  const { userId, sig } = customData as { userId?: unknown; sig?: unknown };
  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId) || typeof sig !== 'string') {
    return null;
  }
  const expected = Buffer.from(sign(userId, secret), 'hex');
  const actual = Buffer.from(sig, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }
  return userId;
}
