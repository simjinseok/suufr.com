'use server';
import type { ServerActionState } from '@/types/index';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { consentSchema } from '@/schemas/auth';
import { authApi } from '@/utils/api/auth';
import { buildConsentPayload } from '@/utils/consent';

type ReconsentFields = { agreeTerms: boolean; agreePrivacy: boolean };
type ReconsentState = ServerActionState<ReconsentFields>;

/**
 * 기존 가입자 재동의 (동의 이력이 없거나 문서 버전이 바뀐 경우).
 * 성공 시 /me 의 consents.required 가 false 가 되어 레이아웃의 재동의 모달이 사라진다.
 */
export async function submitReconsent(
  prevState: ReconsentState,
  formData: FormData,
): Promise<ReconsentState> {
  return await Sentry.withServerActionInstrumentation(
    'submitReconsent',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: ReconsentState = {
        success: false,
        fields: {
          agreeTerms: data.agreeTerms === 'true',
          agreePrivacy: data.agreePrivacy === 'true',
        },
        timestamp: Date.now(),
      };

      const validation = consentSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        await authApi.submitConsents(await buildConsentPayload());
        revalidatePath('/', 'layout');
        state.success = true;
      }
      catch (error: any) {
        state.message = error.message || '동의 처리 중 오류가 발생했습니다';
      }

      return state;
    },
  );
}
