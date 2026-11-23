import { describe, it, expect, vi, beforeEach } from 'vitest';

const update = vi.fn().mockResolvedValue({ success: true, data: {} });
const setStatus = vi.fn().mockResolvedValue({ success: true, data: {} });
vi.mock('@/utils/api', () => ({
  sessionsApi: {
    update: (...args: unknown[]) => update(...args),
    setStatus: (...args: unknown[]) => setStatus(...args),
  },
}));
vi.mock('@/utils/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ user: { id: 'u1' }, organization: { id: 1, uuid: 'org-1' } }),
}));
vi.mock('@/utils/user-settings', () => ({
  getUserSettings: vi.fn().mockResolvedValue({ timezone: 'Asia/Seoul' }),
}));

import { updateSession, setSessionStatus } from './session';

function formData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const base: Record<string, string> = {
    sessionUuid: 'session-1',
    status: 'absent',
    initialStatus: 'absent',
    sessionAt: '2026-11-23T15:00',
    duration: '50',
    notes: '메모',
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

describe('updateSession 상태', () => {
  beforeEach(() => update.mockClear());

  it('상태를 바꾸지 않은 저장은 status를 보내지 않는다', async () => {
    const state = await updateSession({ success: false, timestamp: 0 }, formData());
    expect(state.success).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
    const [uuid, body] = update.mock.calls[0];
    expect(uuid).toBe('session-1');
    expect(body).not.toHaveProperty('status');
    expect(body).toEqual(expect.objectContaining({ duration: 50, notes: '메모' }));
  });

  it('상태를 바꾼 저장은 바뀐 status를 보낸다', async () => {
    const state = await updateSession({ success: false, timestamp: 0 }, formData({ status: 'done' }));
    expect(state.success).toBe(true);
    expect(update).toHaveBeenCalledWith('session-1', expect.objectContaining({ status: 'done' }));
  });

  it('알 수 없는 상태 값은 저장하지 않는다', async () => {
    const state = await updateSession({ success: false, timestamp: 0 }, formData({ status: 'cancelled' }));
    expect(state.success).toBe(false);
    expect(state.fieldErrors?.status).toBeDefined();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('setSessionStatus', () => {
  beforeEach(() => setStatus.mockClear());

  it('setSessionStatus는 상태 변경 API를 부른다', async () => {
    const ok = await setSessionStatus('session-1', 'absent');
    expect(ok).toBe(true);
    expect(setStatus).toHaveBeenCalledWith('session-1', 'absent');
  });
});
