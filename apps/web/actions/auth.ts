'use server';
import type { ServerActionState } from '@/types/index';

import * as Sentry from '@sentry/nextjs';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
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
import { ApiError } from '@/utils/api-client';
import { setMfaSessionCookie, setTokenCookies } from '@/utils/auth-cookies';
import { buildConsentPayload } from '@/utils/consent';

/**
 * Google 로그인·가입 시작 (로그인 페이지). 기존 계정이면 로그인, 없으면 가입이며 약관·방침 고지는 Google 동의 화면이 맡는다.
 * 브라우저를 api 의 /auth/google/start 로 보낸다 (서버 간 호출이 아니라 브라우저가 직접 가야 한다 —
 * better-auth 가 거기서 발급하는 state 쿠키를 콜백에서 대조하기 때문).
 * api /auth/google/start → Google → api /auth/google/callback → api social/google/complete → web /auth/google/login 순으로 돌아온다.
 */
export async function startGoogleLogin() {
  redirect(`${process.env.API_URL}/auth/google/start`);
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
          await setMfaSessionCookie(response.session!);

          state.requiresMfa = true;
          state.challengeName = response.challengeName;
          return state;
        }

        if (response.accessToken && response.refreshToken) {
          await setTokenCookies({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresIn: response.expiresIn,
          });

          state.success = true;
        }
        else {
          // 토큰도 2FA 챌린지도 아닌 응답 — 조용히 끝나면 버튼만 풀리고 아무 안내가 없다
          state.message = '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요';
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
  email: string;
  password: string;
  passwordConfirm: string;
  // 실패 시 체크 상태 복원용
  agreeTerms: boolean;
  agreePrivacy: boolean;
};
type SignupState = ServerActionState<SignupFields> & {
  /** 가입과 동시에 로그인됨 — 바로 앱으로 들어간다. 이메일 인증은 설정(회원정보)에서 나중에 */
  loggedIn?: boolean;
};

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
          email: (data.email as string) || '',
          password: '',
          passwordConfirm: '',
          agreeTerms: data.agreeTerms === 'true',
          agreePrivacy: data.agreePrivacy === 'true',
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
          email: validation.data.email,
          password: validation.data.password,
          // 동의 3종은 Zod 에서 true 로 확정됨. 동의 시점의 문서 버전·IP·UA 를 함께 기록
          consents: await buildConsentPayload(),
          // 가입 폼이 제출 직전에 받은 reCAPTCHA 토큰. 없으면 api 가 RECAPTCHA_MODE 대로 처리
          recaptchaToken: validation.data.recaptchaToken,
        });

        // 실제 가입이면 api 가 바로 로그인시킨다 — 인증 화면을 거치지 않고 앱으로 들어간다 (중복 이메일 합성 응답이면 토큰 없음)
        if (response.accessToken && response.refreshToken) {
          await setTokenCookies({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresIn: response.expiresIn,
          });
          state.loggedIn = true;
        }

        state.success = true;
        state.message = response.message;
      }
      catch (error: any) {
        state.message = error.message || '회원가입 중 오류가 발생했습니다';
        // 계정은 만들어졌지만 인증코드 메일을 못 보낸 경우(MAIL_DELIVERY_FAILED) — 로그인 뒤 설정에서 다시 받을 수 있다
        if (error instanceof ApiError && error.code === 'MAIL_DELIVERY_FAILED') {
          state.message = '계정은 만들어졌지만 인증코드 메일을 보내지 못했습니다. 로그인한 뒤 설정에서 다시 받아주세요.';
        }
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
