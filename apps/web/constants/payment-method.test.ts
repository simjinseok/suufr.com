import { describe, it, expect } from 'vitest';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  DEFAULT_PAYMENT_METHOD,
  isPaymentMethod,
  normalizePaymentMethod,
} from './payment-method';
import * as api from '../../api/src/settings/payment-methods';

describe('payment-method 상수', () => {
  it('허용값은 transfer/card/cash 3종이고 기본값은 transfer', () => {
    expect([...PAYMENT_METHODS]).toEqual(['transfer', 'card', 'cash']);
    expect(DEFAULT_PAYMENT_METHOD).toBe('transfer');
  });

  // web/api 상수는 미러다. api 에 없는 값을 web 이 보내면 설정 저장이 DTO @IsIn 에서 400 으로 막힌다. 순서는 web 화면 몫이라 비교하지 않는다
  it('허용값 집합이 api PAYMENT_METHODS 와 같다', () => {
    expect([...PAYMENT_METHODS].sort()).toEqual([...api.PAYMENT_METHODS].sort());
  });

  it('라벨은 계좌이체/카드/현금', () => {
    expect(PAYMENT_METHOD_LABELS).toEqual({ transfer: '계좌이체', card: '카드', cash: '현금' });
  });

  it.each(['transfer', 'card', 'cash'])('isPaymentMethod(%s) 는 true', (v) => {
    expect(isPaymentMethod(v)).toBe(true);
  });

  it.each(['', 'CARD', 'bitcoin', null, undefined, 1])('isPaymentMethod(%s) 는 false', (v) => {
    expect(isPaymentMethod(v)).toBe(false);
  });

  it('normalizePaymentMethod 는 3종 밖 값을 transfer 로 폴백한다 (과거 데이터·직접 API 호출 대비)', () => {
    expect(normalizePaymentMethod('card')).toBe('card');
    expect(normalizePaymentMethod('bitcoin')).toBe('transfer');
    expect(normalizePaymentMethod(undefined)).toBe('transfer');
  });
});
