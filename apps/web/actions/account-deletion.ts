'use server';
import type { ServerActionState } from '@/types/index';

import * as Sentry from '@sentry/nextjs';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { accountDeleteOtpSchema, accountDeletePasswordSchema } from '@/schemas/auth';
import { authApi } from '@/utils/api/auth';
import { ApiError } from '@/utils/api-client';

/** 계정 삭제 화면이 받는 재인증 방식. 화면은 /auth/me 의 user.hasPassword 로 고른다 */
export type AccountDeletionMethod = 'password' | 'otp';

type DeleteAccountFields = { method: AccountDeletionMethod; password: string; otp: string };
export type DeleteAccountState = ServerActionState<DeleteAccountFields> & {
  // api 오류 코드 (ACCOUNT_DELETE_*). 화면 분기용 — 사용자에게는 message 를 그대로 보여준다
  code?: string;
};

/**
 * 계정 삭제용 이메일 코드 발송. 쿨다운(60초) 중이면 api 가 429(ACCOUNT_DELETE_OTP_COOLDOWN)를 준다.
 * 화면은 code 로 쿨다운을 알아보고, 이미 보낸 코드를 입력할 수 있게 입력칸을 연다
 */
export async function requestAccountDeletionOtp(): Promise<{ success: boolean; message?: string; code?: string }> {
  return await Sentry.withServerActionInstrumentation(
    'requestAccountDeletionOtp',
    { headers: await headers() },
    async () => {
      try {
        await authApi.account.requestDeleteOtp();
        return { success: true };
      }
      catch (error) {
        // api 의 message 는 사용자에게 그대로 보여줄 문장이다. 그 밖의 예외 원문은 보여주지 않는다
        const apiError = error instanceof ApiError ? error : undefined;
        return {
          success: false,
          message: apiError?.message || '인증 코드를 보내지 못했습니다. 잠시 후 다시 시도해주세요',
          code: apiError?.code,
        };
      }
    },
  );
}

/**
 * 계정 삭제(회원 탈퇴). 성공하면 로그인 쿠키를 지우고 /login?deleted=1 로 보낸다.
 * 서버는 즉시 하드 삭제한다(되돌릴 수 없음). 실패 시 api 의 message 를 그대로 돌려준다.
 */
export async function deleteAccount(
  prevState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const state = await Sentry.withServerActionInstrumentation(
    'deleteAccount',
    // 비밀번호·코드가 Sentry 로 가지 않도록 formData 는 넘기지 않는다
    { headers: await headers() },
    async () => {
      const data = Object.fromEntries(formData);
      const method: AccountDeletionMethod = data.method === 'otp' ? 'otp' : 'password';
      const state: DeleteAccountState = {
        success: false,
        fields: { method, password: '', otp: '' },
        timestamp: Date.now(),
      };

      let body: { password?: string; otp?: string };
      if (method === 'password') {
        const validation = accountDeletePasswordSchema.safeParse(data);
        if (!validation.success) {
          state.fieldErrors = z.flattenError(validation.error).fieldErrors;
          return state;
        }
        body = { password: validation.data.password };
      }
      else {
        const validation = accountDeleteOtpSchema.safeParse(data);
        if (!validation.success) {
          state.fieldErrors = z.flattenError(validation.error).fieldErrors;
          return state;
        }
        body = { otp: validation.data.otp };
      }

      try {
        await authApi.account.delete(body);
        state.success = true;
      }
      catch (error) {
        const apiError = error instanceof ApiError ? error : undefined;
        state.code = apiError?.code;
        if (apiError?.status === 401) {
          // 가드의 401 원문은 영어("Invalid token")다. 앞선 삭제 요청이 응답 없이 끝났지만 실제로는 처리된 경우에도 401 이 온다
          state.message = '로그인 정보를 확인할 수 없습니다. 방금 계정 삭제를 요청했다면 계정 삭제 안내 메일이 왔는지 확인해주세요. 아니라면 다시 로그인한 뒤 시도해주세요';
        }
        else {
          state.message = apiError?.message || '계정을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요';
        }
      }
      return state;
    },
  );

  if (!state.success) return state;

  // 계정이 사라졌으므로 서버 로그아웃 호출 없이 쿠키만 지운다 (세션은 서버가 삭제와 함께 지웠다)
  const cookieStore = await cookies();
  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');
  cookieStore.delete('mfa_session');
  cookieStore.delete('organization_uuid');

  // redirect 는 throw 로 동작하므로 계측 래퍼·try 밖에서 부른다
  redirect('/login?deleted=1');
}
