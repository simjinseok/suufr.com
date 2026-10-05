'use server';
import type { ServerActionState } from '@/types/index';

import * as Sentry from '@sentry/nextjs';
import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import {
  loginSchema,
  signupSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  mfaSchema,
} from '@/schemas/auth';
import { authApi } from '@/utils/api/auth';
import { buildConsentPayload } from '@/utils/consent';

// refresh_token(= better-auth 세션 토큰) 쿠키 수명. api 의 세션 수명(30일)과 같다
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;

// 로그인 성공 시 토큰 쿠키 세팅 (login/respondToMfa 공용)
// access_token = better-auth JWT(1시간), refresh_token = better-auth 세션 토큰(30일).
async function setTokenCookies(response: {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}) {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';

  cookieStore.set('access_token', response.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: (response.expiresIn || 3600) - 60,
  });

  cookieStore.set('refresh_token', response.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

// Login action
type LoginFields = { email: string; password: string };
type LoginState = ServerActionState<LoginFields> & {
  requiresMfa?: boolean;
  challengeName?: string;
};

export async function login(
  prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  return await Sentry.withServerActionInstrumentation(
    'login',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: LoginState = {
        success: false,
        fields: {
          email: (data.email as string) || '',
          password: '',
        },
        timestamp: Date.now(),
      };

      const validation = loginSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        const response = await authApi.login({
          email: validation.data.email,
          password: validation.data.password,
        });

        // 2단계 인증 챌린지 — two_factor 쿠키 쌍(session)을 5분간 쿠키에 보관
        if (response.requiresMfa) {
          const cookieStore = await cookies();
          cookieStore.set('mfa_session', response.session!, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 300,
          });

          state.requiresMfa = true;
          state.challengeName = response.challengeName;
          return state;
        }

        if (response.accessToken) {
          await setTokenCookies({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken!,
            expiresIn: response.expiresIn,
          });

          state.success = true;
        }
      }
      catch (error: any) {
        state.message = error.message || '로그인 중 오류가 발생했습니다';
      }

      return state;
    },
  );
}

// MFA response action
type MfaFields = { code: string };
type MfaState = ServerActionState<MfaFields>;

export async function respondToMfa(
  prevState: MfaState,
  formData: FormData,
): Promise<MfaState> {
  return await Sentry.withServerActionInstrumentation(
    'respondToMfa',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: MfaState = {
        success: false,
        fields: {
          code: '',
        },
        timestamp: Date.now(),
      };

      const validation = mfaSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      const cookieStore = await cookies();
      const session = cookieStore.get('mfa_session')?.value;

      if (!session) {
        state.message = 'MFA 세션이 만료되었습니다. 다시 로그인해주세요.';
        return state;
      }

      try {
        const response = await authApi.mfa({
          code: validation.data.code,
          session,
        });

        await setTokenCookies(response);

        cookieStore.delete('mfa_session');

        state.success = true;
      }
      catch (error: any) {
        state.message = error.message || 'MFA 인증 중 오류가 발생했습니다';
      }

      return state;
    },
  );
}

// Signup action
type SignupFields = {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  // 실패 시 체크 상태 복원용
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeOverseasTransfer: boolean;
};
type SignupState = ServerActionState<SignupFields>;

export async function signup(
  prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  return await Sentry.withServerActionInstrumentation(
    'signup',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: SignupState = {
        success: false,
        fields: {
          name: (data.name as string) || '',
          email: (data.email as string) || '',
          password: '',
          passwordConfirm: '',
          agreeTerms: data.agreeTerms === 'true',
          agreePrivacy: data.agreePrivacy === 'true',
          agreeOverseasTransfer: data.agreeOverseasTransfer === 'true',
        },
        timestamp: Date.now(),
      };

      const validation = signupSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        const response = await authApi.signup({
          name: validation.data.name,
          email: validation.data.email,
          password: validation.data.password,
          // 동의 3종은 Zod 에서 true 로 확정됨. 동의 시점의 문서 버전·IP·UA 를 함께 기록
          consents: await buildConsentPayload(),
        });

        state.success = true;
        state.message = response.message;
      }
      catch (error: any) {
        state.message = error.message || '회원가입 중 오류가 발생했습니다';
      }

      return state;
    },
  );
}

// Verify email action
type VerifyEmailFields = { email: string; code: string };
type VerifyEmailState = ServerActionState<VerifyEmailFields>;

export async function verifyEmail(
  prevState: VerifyEmailState,
  formData: FormData,
): Promise<VerifyEmailState> {
  return await Sentry.withServerActionInstrumentation(
    'verifyEmail',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: VerifyEmailState = {
        success: false,
        fields: {
          email: (data.email as string) || '',
          code: '',
        },
        timestamp: Date.now(),
      };

      const validation = verifyEmailSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        const response = await authApi.verifyEmail({
          email: validation.data.email,
          code: validation.data.code,
        });

        state.success = true;
        state.message = response.message;
      }
      catch (error: any) {
        state.message = error.message || '이메일 인증 중 오류가 발생했습니다';
      }

      return state;
    },
  );
}

// Resend verification code action
type ResendVerificationFields = { email: string };
type ResendVerificationState = ServerActionState<ResendVerificationFields>;

export async function resendVerification(
  prevState: ResendVerificationState,
  formData: FormData,
): Promise<ResendVerificationState> {
  return await Sentry.withServerActionInstrumentation(
    'resendVerification',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: ResendVerificationState = {
        success: false,
        fields: {
          email: (data.email as string) || '',
        },
        timestamp: Date.now(),
      };

      const email = data.email as string;
      if (!email) {
        state.message = '이메일을 입력해주세요';
        return state;
      }

      try {
        const response = await authApi.resendVerification({ email });

        state.success = true;
        state.message = response.message;
      }
      catch (error: any) {
        state.message = error.message || '인증코드 발송 중 오류가 발생했습니다';
      }

      return state;
    },
  );
}

// Forgot password action
type ForgotPasswordFields = { email: string };
type ForgotPasswordState = ServerActionState<ForgotPasswordFields>;

export async function forgotPassword(
  prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  return await Sentry.withServerActionInstrumentation(
    'forgotPassword',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: ForgotPasswordState = {
        success: false,
        fields: {
          email: (data.email as string) || '',
        },
        timestamp: Date.now(),
      };

      const validation = forgotPasswordSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        const response = await authApi.forgotPassword({
          email: validation.data.email,
        });

        state.success = true;
        state.message = response.message;
      }
      catch (error: any) {
        state.message = error.message || '비밀번호 재설정 요청 중 오류가 발생했습니다';
      }

      return state;
    },
  );
}

// Reset password action
type ResetPasswordFields = {
  email: string;
  code: string;
  password: string;
  passwordConfirm: string;
};
type ResetPasswordState = ServerActionState<ResetPasswordFields>;

export async function resetPassword(
  prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  return await Sentry.withServerActionInstrumentation(
    'resetPassword',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: ResetPasswordState = {
        success: false,
        fields: {
          email: (data.email as string) || '',
          code: '',
          password: '',
          passwordConfirm: '',
        },
        timestamp: Date.now(),
      };

      const validation = resetPasswordSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        const response = await authApi.resetPassword({
          email: validation.data.email,
          code: validation.data.code,
          password: validation.data.password,
        });

        state.success = true;
        state.message = response.message;
      }
      catch (error: any) {
        state.message = error.message || '비밀번호 재설정 중 오류가 발생했습니다';
      }

      return state;
    },
  );
}
