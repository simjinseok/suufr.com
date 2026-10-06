import { apiClient } from '../api-client';

type LoginResponse = {
  success: boolean;
  requiresMfa?: boolean;
  challengeName?: string;
  // 2단계 인증 챌린지의 two_factor 쿠키 쌍 (mfa 요청에 그대로 돌려보낸다)
  session?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  userId?: string;
};

type MfaResponse = {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
};

type SignupResponse = {
  success: boolean;
  message: string;
};

type VerifyEmailResponse = {
  success: boolean;
  message: string;
};

type ForgotPasswordResponse = {
  success: boolean;
  message: string;
};

type ResetPasswordResponse = {
  success: boolean;
  message: string;
};

export type ConsentPayload = {
  terms: true;
  privacy: true;
  termsVersion: string;
  privacyVersion: string;
  ipAddress?: string;
  userAgent?: string;
};

export type ConsentStatus = {
  terms: string | null;
  privacy: string | null;
  required: boolean;
};

type SubmitConsentsResponse = {
  success: boolean;
  consents: ConsentStatus;
};

type RefreshTokenResponse = {
  success: boolean;
  accessToken: string;
  expiresIn: number;
};

type TwoFactorEnableResponse = {
  success: boolean;
  totpURI: string;
  backupCodes: string[];
};

type TwoFactorBackupCodesResponse = {
  success: boolean;
  backupCodes: string[];
};

type SocialStartResponse = { success: boolean; url?: string; message?: string };
type SocialExchangeResponse
  = | (MfaResponse & { requiresMfa?: undefined })
    | { success: true; requiresMfa: true; challengeName: 'TOTP'; session: string }
    | { success: false; message: string };

export const authApi = {
  // 소셜 로그인 (Google). start 는 인증 URL, exchange 는 api 콜백이 발급한 일회용 코드를 토큰으로 교환
  social: {
    start: (provider: 'google') =>
      apiClient<SocialStartResponse>(`/api/auth/social/${provider}/start`, { method: 'POST', body: {} }),
    exchange: (data: { code: string }) =>
      apiClient<SocialExchangeResponse>('/api/auth/social/exchange', { method: 'POST', body: data }),
  },

  login: (data: { email: string; password: string }) =>
    apiClient<LoginResponse>('/api/auth/login', { method: 'POST', body: data }),

  mfa: (data: { code: string; session: string }) =>
    apiClient<MfaResponse>('/api/auth/mfa', { method: 'POST', body: data }),

  signup: (data: { name: string; email: string; password: string; consents: ConsentPayload }) =>
    apiClient<SignupResponse>('/api/auth/signup', { method: 'POST', body: data }),

  // 기존 가입자 재동의 (인증 필요)
  submitConsents: (data: ConsentPayload) =>
    apiClient<SubmitConsentsResponse>('/api/auth/consents', { method: 'POST', body: data }),

  verifyEmail: (data: { email: string; code: string }) =>
    apiClient<VerifyEmailResponse>('/api/auth/verify-email', { method: 'POST', body: data }),

  resendVerification: (data: { email: string }) =>
    apiClient<SignupResponse>('/api/auth/resend-verification', { method: 'POST', body: data }),

  forgotPassword: (data: { email: string }) =>
    apiClient<ForgotPasswordResponse>('/api/auth/forgot-password', { method: 'POST', body: data }),

  resetPassword: (data: { email: string; code: string; password: string }) =>
    apiClient<ResetPasswordResponse>('/api/auth/reset-password', { method: 'POST', body: data }),

  refresh: (data: { refreshToken: string }) =>
    apiClient<RefreshTokenResponse>('/api/auth/refresh', { method: 'POST', body: data }),

  // 서버 세션 폐기 (refresh_token 쿠키 값). access_token 만료 여부와 무관
  logout: (data: { refreshToken: string }) =>
    apiClient<{ success: boolean }>('/api/auth/logout', { method: 'POST', body: data }),

  // 2단계 인증(TOTP) 관리 — 세션 토큰 필요
  twoFactor: {
    enable: (data: { password: string }) =>
      apiClient<TwoFactorEnableResponse>('/api/auth/two-factor/enable', { method: 'POST', body: data, withSessionToken: true }),
    verifySetup: (data: { code: string }) =>
      apiClient<SignupResponse>('/api/auth/two-factor/verify-setup', { method: 'POST', body: data, withSessionToken: true }),
    disable: (data: { password: string }) =>
      apiClient<SignupResponse>('/api/auth/two-factor/disable', { method: 'POST', body: data, withSessionToken: true }),
    regenerateBackupCodes: (data: { password: string }) =>
      apiClient<TwoFactorBackupCodesResponse>('/api/auth/two-factor/backup-codes', { method: 'POST', body: data, withSessionToken: true }),
  },
};
