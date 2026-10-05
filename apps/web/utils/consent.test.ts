import { describe, expect, it } from 'vitest';
import { extractClientIp } from './consent';

describe('extractClientIp', () => {
  it('x-forwarded-for 의 첫 값을 쓴다', () => {
    expect(extractClientIp(new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5');
  });

  it('x-forwarded-for 가 없으면 x-real-ip 를 쓴다', () => {
    expect(extractClientIp(new Headers({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1');
  });

  it('형식이 이상하면 undefined (가입을 막지 않는다)', () => {
    expect(extractClientIp(new Headers({ 'x-forwarded-for': 'unknown' }))).toBeUndefined();
    expect(extractClientIp(new Headers())).toBeUndefined();
  });
});
