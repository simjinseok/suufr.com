'use server';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';

import { getSession } from '@/utils/auth';
import { studentSharesApi } from '@/utils/api';

type CreateStudentShareState = {
  success: boolean;
  shareId?: string;
  expiresAt?: string;
  timestamp: number;
};
export async function createStudentShare(prevState: CreateStudentShareState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createStudentShare',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const state: CreateStudentShareState = {
        success: false,
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) {
        return state;
      }

      const studentUuid = formData.get('studentUuid') as string;
      const showPayments = formData.get('showPayments') !== 'false';
      const result = await studentSharesApi.create({ studentUuid, showPayments });

      state.success = true;
      state.shareId = result.data.shareId;
      state.expiresAt = result.data.expiresAt;
      return state;
    },
  );
}

type DeleteStudentShareState = {
  success: boolean;
  timestamp: number;
};
export async function deleteStudentShare(prevState: DeleteStudentShareState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'deleteStudentShare',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const state: DeleteStudentShareState = {
        success: false,
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) {
        return state;
      }

      const shareId = formData.get('shareId') as string;
      await studentSharesApi.remove(shareId);

      state.success = true;
      return state;
    },
  );
}
