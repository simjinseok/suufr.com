import { apiClient } from '../api-client';

type LoginResponse = {
  success: boolean;
  requiresMfa?: boolean;
  requiresNewPassword?: boolean;
  challengeName?: string;
  session?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  cognitoUsername?: string;
};

type MfaResponse = {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  cognitoUsername: string;
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
  overseasTransfer: true;
  termsVersion: string;
  privacyVersion: string;
  ipAddress?: string;
  userAgent?: string;
};

export type ConsentStatus = {
  terms: string | null;
  privacy: string | null;
  overseasTransfer: string | null;
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

export const authApi = {
  login: (data: { email: string; password: string }) =>
    apiClient<LoginResponse>('/api/auth/login', { method: 'POST', body: data }),

  mfa: (data: { email: string; code: string; session: string }) =>
    apiClient<MfaResponse>('/api/auth/mfa', { method: 'POST', body: data }),

  newPassword: (data: { email: string; password: string; session: string }) =>
    apiClient<MfaResponse>('/api/auth/new-password', { method: 'POST', body: data }),

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

  refresh: (data: { refreshToken: string; username: string }) =>
    apiClient<RefreshTokenResponse>('/api/auth/refresh', { method: 'POST', body: data }),
};
