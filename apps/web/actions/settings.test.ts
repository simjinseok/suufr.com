import { describe, it, expect, vi, beforeEach } from 'vitest';

const update = vi.fn().mockResolvedValue({ success: true, data: {} });
vi.mock('@/utils/api/settings', () => ({ settingsApi: { update: (...args: unknown[]) => update(...args), get: vi.fn() } }));
vi.mock('@/utils/user-settings', () => ({ getUserSettings: vi.fn() }));

import { updateSettings } from './settings';

function formData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const base: Record<string, string> = {
    use24HourFormat: 'on',
    defaultDuration: '50',
    autoUpdateNextPaymentAt: 'on',
    timezone: 'Asia/Seoul',
    defaultPaymentMethod: 'card',
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

describe('updateSettings 기본 결제수단', () => {
  beforeEach(() => update.mockClear());

  it('허용값이면 API 로 전달한다', async () => {
    const state = await updateSettings({ fields: {} as never }, formData({ defaultPaymentMethod: 'cash' }));
    expect(state.success).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ defaultPaymentMethod: 'cash' }));
  });

  it('3종 밖 값이면 fieldErrors 로 거부하고 API 를 호출하지 않는다', async () => {
    const state = await updateSettings({ fields: {} as never }, formData({ defaultPaymentMethod: 'bitcoin' }));
    expect(state.success).toBe(false);
    expect(state.fieldErrors?.defaultPaymentMethod?.[0]).toBe('결제수단을 선택해주세요');
    expect(update).not.toHaveBeenCalled();
  });

  it('꺼진 스위치는 FormData 에 키가 없다 — 없는 boolean 은 false 로 저장한다', async () => {
    const fd = formData();
    fd.delete('use24HourFormat');
    const state = await updateSettings({ fields: {} as never }, fd);
    expect(state.fieldErrors).toBeUndefined();
    expect(state.success).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ use24HourFormat: false, autoUpdateNextPaymentAt: true }));
  });

  it('누락되면 거부한다 (폼은 항상 보낸다)', async () => {
    const fd = formData();
    fd.delete('defaultPaymentMethod');
    const state = await updateSettings({ fields: {} as never }, fd);
    expect(state.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
