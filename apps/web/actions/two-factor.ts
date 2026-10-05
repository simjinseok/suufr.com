'use server';
import type { ServerActionState } from '@/types/index';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { twoFactorCodeSchema, twoFactorPasswordSchema } from '@/schemas/auth';
import { authApi } from '@/utils/api/auth';

type PasswordFields = { password: string };
type CodeFields = { code: string };

export type EnableTwoFactorState = ServerActionState<PasswordFields> & {
  totpURI?: string;
  backupCodes?: string[];
};

/** 1단계: 비밀번호 확인 후 TOTP 시드·백업코드 발급. 인증 앱 코드로 verifyTwoFactorSetup 을 마쳐야 활성화된다 */
export async function enableTwoFactor(
  prevState: EnableTwoFactorState,
  formData: FormData,
): Promise<EnableTwoFactorState> {
  return await Sentry.withServerActionInstrumentation(
    'enableTwoFactor',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: EnableTwoFactorState = { success: false, fields: { password: '' }, timestamp: Date.now() };

      const validation = twoFactorPasswordSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        const response = await authApi.twoFactor.enable({ password: validation.data.password });
        state.success = true;
        state.totpURI = response.totpURI;
        state.backupCodes = response.backupCodes;
      }
      catch (error: any) {
        state.message = error.message || '2단계 인증 설정 중 오류가 발생했습니다';
      }
      return state;
    },
  );
}

/** 2단계: 인증 앱 6자리 코드 확인 → twoFactorEnabled=true */
export async function verifyTwoFactorSetup(
  prevState: ServerActionState<CodeFields>,
  formData: FormData,
): Promise<ServerActionState<CodeFields>> {
  return await Sentry.withServerActionInstrumentation(
    'verifyTwoFactorSetup',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: ServerActionState<CodeFields> = { success: false, fields: { code: '' }, timestamp: Date.now() };

      const validation = twoFactorCodeSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        const response = await authApi.twoFactor.verifySetup({ code: validation.data.code });
        revalidatePath('/', 'layout');
        state.success = true;
        state.message = response.message;
      }
      catch (error: any) {
        state.message = error.message || '코드 확인 중 오류가 발생했습니다';
      }
      return state;
    },
  );
}

export async function disableTwoFactor(
  prevState: ServerActionState<PasswordFields>,
  formData: FormData,
): Promise<ServerActionState<PasswordFields>> {
  return await Sentry.withServerActionInstrumentation(
    'disableTwoFactor',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: ServerActionState<PasswordFields> = { success: false, fields: { password: '' }, timestamp: Date.now() };

      const validation = twoFactorPasswordSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        const response = await authApi.twoFactor.disable({ password: validation.data.password });
        revalidatePath('/', 'layout');
        state.success = true;
        state.message = response.message;
      }
      catch (error: any) {
        state.message = error.message || '2단계 인증 해제 중 오류가 발생했습니다';
      }
      return state;
    },
  );
}

export type BackupCodesState = ServerActionState<PasswordFields> & { backupCodes?: string[] };

/** 백업코드 재발급 — 기존 코드는 모두 무효화된다 */
export async function regenerateBackupCodes(
  prevState: BackupCodesState,
  formData: FormData,
): Promise<BackupCodesState> {
  return await Sentry.withServerActionInstrumentation(
    'regenerateBackupCodes',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: BackupCodesState = { success: false, fields: { password: '' }, timestamp: Date.now() };

      const validation = twoFactorPasswordSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        const response = await authApi.twoFactor.regenerateBackupCodes({ password: validation.data.password });
        state.success = true;
        state.backupCodes = response.backupCodes;
      }
      catch (error: any) {
        state.message = error.message || '백업코드 재발급 중 오류가 발생했습니다';
      }
      return state;
    },
  );
}
