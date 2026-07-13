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
  newPasswordSchema,
} from '@/schemas/auth';
import { authApi } from '@/utils/api/auth';

// 로그인 성공 시 토큰 쿠키 세팅 (login/respondToMfa/respondToNewPassword 공용)
async function setTokenCookies(response: {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  cognitoUsername: string;
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
  });

  cookieStore.set('cognito_username', response.cognitoUsername, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  });
}

// Login action
type LoginFields = { email: string; password: string };
type LoginState = ServerActionState<LoginFields> & {
  requiresMfa?: boolean;
  requiresNewPassword?: boolean;
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

        // 추가 인증 챌린지 (MFA 코드 입력 또는 새 비밀번호 설정) — 세션을 쿠키에 보관
        if (response.requiresMfa || response.requiresNewPassword) {
          const cookieStore = await cookies();
          cookieStore.set('mfa_session', response.session!, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 300,
          });
          cookieStore.set('mfa_email', validation.data.email, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 300,
          });

          state.requiresMfa = response.requiresMfa;
          state.requiresNewPassword = response.requiresNewPassword;
          state.challengeName = response.challengeName;
          return state;
        }

        if (response.accessToken) {
          await setTokenCookies({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken!,
            expiresIn: response.expiresIn,
            cognitoUsername: response.cognitoUsername!,
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
      const email = cookieStore.get('mfa_email')?.value;

      if (!session || !email) {
        state.message = 'MFA 세션이 만료되었습니다. 다시 로그인해주세요.';
        return state;
      }

      try {
        const response = await authApi.mfa({
          email,
          code: validation.data.code,
          session,
        });

        await setTokenCookies(response);

        cookieStore.delete('mfa_session');
        cookieStore.delete('mfa_email');

        state.success = true;
      }
      catch (error: any) {
        state.message = error.message || 'MFA 인증 중 오류가 발생했습니다';
      }

      return state;
    },
  );
}

// NEW_PASSWORD_REQUIRED 챌린지 대응 — 임시 비밀번호 계정의 새 비밀번호 설정
type NewPasswordFields = { password: string; passwordConfirm: string };
type NewPasswordState = ServerActionState<NewPasswordFields>;

export async function respondToNewPassword(
  prevState: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  return await Sentry.withServerActionInstrumentation(
    'respondToNewPassword',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: NewPasswordState = {
        success: false,
        fields: {
          password: '',
          passwordConfirm: '',
        },
        timestamp: Date.now(),
      };

      const validation = newPasswordSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      const cookieStore = await cookies();
      const session = cookieStore.get('mfa_session')?.value;
      const email = cookieStore.get('mfa_email')?.value;

      if (!session || !email) {
        state.message = '세션이 만료되었습니다. 다시 로그인해주세요.';
        return state;
      }

      try {
        const response = await authApi.newPassword({
          email,
          password: validation.data.password,
          session,
        });

        await setTokenCookies(response);

        cookieStore.delete('mfa_session');
        cookieStore.delete('mfa_email');

        state.success = true;
      }
      catch (error: any) {
        state.message = error.message || '비밀번호 변경 중 오류가 발생했습니다';
      }

      return state;
    },
  );
}

// Signup action
type SignupFields = { name: string; email: string; password: string; passwordConfirm: string };
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
