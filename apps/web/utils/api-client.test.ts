import { afterEach, assert, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));

import { ApiError, NETWORK_ERROR, NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE, apiClient } from './api-client';

describe('apiClient 에러 변환', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetch 자체가 실패하면(api 다운) 원문 대신 한국어 안내와 NETWORK_ERROR 코드를 가진 ApiError 를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const error = await apiClient('/auth/login', { method: 'POST', body: {} }).catch(e => e);
    assert.instanceOf(error, ApiError);
    expect(error.message).toBe(NETWORK_ERROR_MESSAGE);
    expect(error.code).toBe(NETWORK_ERROR);
    expect(error.status).toBe(0);
  });

  it('에러 본문이 JSON 이 아니면 "API Error: 502" 같은 원문 대신 일반 안내를 쓴다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 })));
    const error = await apiClient('/auth/login').catch(e => e);
    assert.instanceOf(error, ApiError);
    expect(error.status).toBe(502);
    expect(error.message).toBe(UNEXPECTED_RESPONSE_MESSAGE);
  });

  it('필터 형식({ error: { code, message } })은 코드와 메시지를 그대로 쓴다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: false, error: { code: 'TOO_MANY_REQUESTS', message: '요청이 너무 많습니다' } }, { status: 429 })));
    const error = await apiClient('/auth/login').catch(e => e);
    assert.instanceOf(error, ApiError);
    expect(error.code).toBe('TOO_MANY_REQUESTS');
    expect(error.message).toBe('요청이 너무 많습니다');
  });
});
