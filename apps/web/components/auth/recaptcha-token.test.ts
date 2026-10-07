import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireRecaptchaToken, type GrecaptchaEnterprise } from './recaptcha-token';

function fakeGrecaptcha(execute: () => Promise<string>): GrecaptchaEnterprise {
  return {
    ready: cb => cb(),
    execute: vi.fn(execute),
  };
}

const base = { siteKey: 'site', action: 'signup', timeoutMs: 8000, pollMs: 100 };

describe('acquireRecaptchaToken', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('grecaptcha 가 이미 있으면 execute 결과를 돌려준다', async () => {
    const g = fakeGrecaptcha(async () => 'tok');
    const promise = acquireRecaptchaToken({ ...base, getGrecaptcha: () => g, scriptFailed: () => false });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('tok');
    expect(g.execute).toHaveBeenCalledWith('site', { action: 'signup' });
  });

  it('스크립트가 늦게 도착하면(로딩 중) 기다렸다가 토큰을 받는다', async () => {
    let g: GrecaptchaEnterprise | undefined;
    const promise = acquireRecaptchaToken({ ...base, getGrecaptcha: () => g, scriptFailed: () => false });
    await vi.advanceTimersByTimeAsync(2000);
    g = fakeGrecaptcha(async () => 'late-tok');
    await vi.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toBe('late-tok');
  });

  it('시간 예산 안에 스크립트가 안 오면 undefined (던지지 않는다)', async () => {
    const promise = acquireRecaptchaToken({ ...base, getGrecaptcha: () => undefined, scriptFailed: () => false });
    await vi.advanceTimersByTimeAsync(8100);
    await expect(promise).resolves.toBeUndefined();
  });

  it('스크립트 로드 실패(onError)가 확정되면 기다리지 않고 바로 undefined', async () => {
    const promise = acquireRecaptchaToken({ ...base, getGrecaptcha: () => undefined, scriptFailed: () => true });
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toBeUndefined();
  });

  it('execute 가 reject 되면 undefined', async () => {
    const g = fakeGrecaptcha(() => Promise.reject(new Error('boom')));
    const promise = acquireRecaptchaToken({ ...base, getGrecaptcha: () => g, scriptFailed: () => false });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
  });

  it('execute 가 끝내 응답하지 않으면 남은 예산이 지난 뒤 undefined', async () => {
    const g = fakeGrecaptcha(() => new Promise<string>(() => {}));
    const promise = acquireRecaptchaToken({ ...base, getGrecaptcha: () => g, scriptFailed: () => false });
    await vi.advanceTimersByTimeAsync(8100);
    await expect(promise).resolves.toBeUndefined();
  });
});
