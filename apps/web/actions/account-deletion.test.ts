import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cookies } from 'next/headers';

const deleteAccountApi = vi.fn();
const requestDeleteOtp = vi.fn();
vi.mock('@/utils/api/auth', () => ({
  authApi: {
    account: {
      delete: (...args: unknown[]) => deleteAccountApi(...args),
      requestDeleteOtp: (...args: unknown[]) => requestDeleteOtp(...args),
    },
  },
}));

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));

import { deleteAccount, requestAccountDeletionOtp } from './account-deletion';
import { ApiError } from '@/utils/api-client';

function formData(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const cookieDelete = vi.fn();

describe('deleteAccount', () => {
  beforeEach(() => {
    deleteAccountApi.mockReset();
    redirect.mockClear();
    cookieDelete.mockClear();
    vi.mocked(cookies).mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: cookieDelete } as never);
  });

  it('비밀번호 방식이면 password 만 보내고, 성공하면 쿠키를 지운 뒤 /login?deleted=1 로 보낸다', async () => {
    deleteAccountApi.mockResolvedValue({ success: true });
    await expect(deleteAccount({}, formData({ method: 'password', password: 'secret-pw', otp: '' })))
      .rejects.toThrow('NEXT_REDIRECT:/login?deleted=1');
    expect(deleteAccountApi).toHaveBeenCalledWith({ password: 'secret-pw' });
    expect(cookieDelete).toHaveBeenCalledWith('access_token');
    expect(cookieDelete).toHaveBeenCalledWith('refresh_token');
  });

  it('코드 방식이면 otp 만 보낸다', async () => {
    deleteAccountApi.mockResolvedValue({ success: true });
    await expect(deleteAccount({}, formData({ method: 'otp', password: '', otp: '123456' })))
      .rejects.toThrow('NEXT_REDIRECT:/login?deleted=1');
    expect(deleteAccountApi).toHaveBeenCalledWith({ otp: '123456' });
  });

  it('입력이 비었거나 6자리 숫자가 아니면 api 를 부르지 않는다', async () => {
    const a = await deleteAccount({}, formData({ method: 'password', password: '' }));
    expect(a.fieldErrors?.password).toBeDefined();
    const b = await deleteAccount({}, formData({ method: 'otp', otp: '12ab56' }));
    expect(b.fieldErrors?.otp).toBeDefined();
    expect(deleteAccountApi).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('api 가 거부하면 message·code 를 그대로 돌려주고 쿠키는 지우지 않는다', async () => {
    deleteAccountApi.mockRejectedValue(new ApiError('비밀번호가 올바르지 않습니다', { code: 'ACCOUNT_DELETE_INVALID_PASSWORD', status: 400 }));
    const state = await deleteAccount({}, formData({ method: 'password', password: 'wrong' }));
    expect(state.success).toBe(false);
    expect(state.message).toBe('비밀번호가 올바르지 않습니다');
    expect(state.code).toBe('ACCOUNT_DELETE_INVALID_PASSWORD');
    expect(cookieDelete).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('401 이면 가드의 영어 원문 대신 한국어 안내를 돌려준다 (앞선 요청이 이미 삭제했을 수 있다)', async () => {
    deleteAccountApi.mockRejectedValue(new ApiError('Invalid token', { code: 'UNAUTHORIZED', status: 401 }));
    const state = await deleteAccount({}, formData({ method: 'password', password: 'secret-pw' }));
    expect(state.success).toBe(false);
    expect(state.message).not.toContain('Invalid token');
    expect(state.message).toContain('계정 삭제 안내 메일');
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('requestAccountDeletionOtp', () => {
  // 중괄호 필수 — 함수를 반환하면 vitest 가 teardown 으로 호출한다
  beforeEach(() => {
    requestDeleteOtp.mockReset();
  });

  it('쿨다운(429) 등 실패하면 api message·code 를 돌려준다 (화면은 code 로 쿨다운을 알아본다)', async () => {
    requestDeleteOtp.mockRejectedValue(new ApiError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요', { code: 'ACCOUNT_DELETE_OTP_COOLDOWN', status: 429 }));
    expect(await requestAccountDeletionOtp()).toEqual({
      success: false,
      message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
      code: 'ACCOUNT_DELETE_OTP_COOLDOWN',
    });
  });

  it('성공하면 success: true', async () => {
    requestDeleteOtp.mockResolvedValue({ success: true });
    expect(await requestAccountDeletionOtp()).toEqual({ success: true });
  });
});
