import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ApiError } from '@/utils/api-client';

const login = vi.fn();
const signup = vi.fn();
const verifyEmailApi = vi.fn();
vi.mock('@/utils/api/auth', () => ({
  authApi: {
    login: (...args: unknown[]) => login(...args),
    signup: (...args: unknown[]) => signup(...args),
    verifyEmail: (...args: unknown[]) => verifyEmailApi(...args),
  },
}));
const setTokenCookies = vi.fn();
vi.mock('@/utils/auth-cookies', () => ({
  setTokenCookies: (...args: unknown[]) => setTokenCookies(...args),
  setMfaSessionCookie: vi.fn(),
}));

import { login as loginAction, signup as signupAction, verifyEmail as verifyEmailAction } from './auth';

function formData(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const EMAIL = 'owner@example.com';
const PASSWORD = 'Passw0rd!x';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('login — 미인증 계정', () => {
  it('EMAIL_NOT_VERIFIED 면 인증코드 화면으로 보낸다 (에러 문구는 띄우지 않는다)', async () => {
    login.mockRejectedValue(new ApiError('이메일 인증이 필요합니다', { code: 'EMAIL_NOT_VERIFIED', status: 403 }));
    const state = await loginAction({ fields: {} as never }, formData({ email: EMAIL, password: PASSWORD }));
    expect(state).toMatchObject({ success: false, requiresVerification: true, fields: { email: EMAIL } });
    expect(state.mailFailed).toBeUndefined();
    expect(state.message).toBeUndefined();
    expect(setTokenCookies).not.toHaveBeenCalled();
  });

  it('인증 메일을 못 보냈으면(MAIL_DELIVERY_FAILED) 인증코드 화면에서 다시 받게 mailFailed 를 함께 준다', async () => {
    login.mockRejectedValue(new ApiError('인증 메일을 보내지 못했습니다', { code: 'MAIL_DELIVERY_FAILED', status: 503 }));
    const state = await loginAction({ fields: {} as never }, formData({ email: EMAIL, password: PASSWORD }));
    expect(state).toMatchObject({ success: false, requiresVerification: true, mailFailed: true });
    expect(state.message).toBeUndefined();
  });

  it('그 밖의 실패는 인증 화면으로 보내지 않고 문구를 띄운다', async () => {
    login.mockRejectedValue(new ApiError('이메일 또는 비밀번호가 올바르지 않습니다', { code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 }));
    const state = await loginAction({ fields: {} as never }, formData({ email: EMAIL, password: PASSWORD }));
    expect(state.requiresVerification).toBeUndefined();
    expect(state.message).toBe('이메일 또는 비밀번호가 올바르지 않습니다');
  });
});

describe('signup', () => {
  const signupForm = () => formData({
    email: EMAIL, password: PASSWORD, passwordConfirm: PASSWORD, agreeTerms: 'true', agreePrivacy: 'true',
  });

  it('새 계정이면 인증코드 화면으로 보낸다', async () => {
    signup.mockResolvedValue({ success: true, requiresVerification: true, message: '인증 이메일이 발송되었습니다' });
    const state = await signupAction({ fields: {} as never }, signupForm());
    expect(state).toMatchObject({ success: true, requiresVerification: true });
    expect(state.mailFailed).toBeUndefined();
  });

  it('인증 메일만 못 보냈으면(MAIL_DELIVERY_FAILED) 성공으로 보고 mailFailed 와 함께 인증코드 화면으로 보낸다', async () => {
    signup.mockRejectedValue(new ApiError('인증 메일을 보내지 못했습니다', { code: 'MAIL_DELIVERY_FAILED', status: 503 }));
    const state = await signupAction({ fields: {} as never }, signupForm());
    expect(state).toMatchObject({ success: true, requiresVerification: true, mailFailed: true });
  });

  it('중복 이메일(인증 필요 표시 없음)이면 인증코드 화면으로 보내지 않는다', async () => {
    signup.mockResolvedValue({ success: true, message: '이미 가입된 이메일입니다. 로그인해주세요.' });
    const state = await signupAction({ fields: {} as never }, signupForm());
    expect(state).toMatchObject({ success: true, requiresVerification: false });
  });
});

describe('verifyEmail', () => {
  const verifyForm = () => formData({ email: EMAIL, code: '123456' });

  it('토큰을 받으면 쿠키를 심고 loggedIn 으로 바로 앱에 들어가게 한다', async () => {
    verifyEmailApi.mockResolvedValue({ success: true, accessToken: 'jwt', refreshToken: 'sess', expiresIn: 3600, message: '이메일 인증이 완료되었습니다' });
    const state = await verifyEmailAction({ fields: {} as never }, verifyForm());
    expect(setTokenCookies).toHaveBeenCalledWith({ accessToken: 'jwt', refreshToken: 'sess', expiresIn: 3600 });
    expect(state).toMatchObject({ success: true, loggedIn: true });
  });

  it('토큰이 없으면(이미 인증됐거나 2단계 인증 계정) 쿠키 없이 성공만 알린다 — 로그인 화면으로 간다', async () => {
    verifyEmailApi.mockResolvedValue({ success: true, message: '이메일 인증이 완료되었습니다' });
    const state = await verifyEmailAction({ fields: {} as never }, verifyForm());
    expect(setTokenCookies).not.toHaveBeenCalled();
    expect(state.success).toBe(true);
    expect(state.loggedIn).toBeUndefined();
  });
});
