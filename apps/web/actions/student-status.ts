'use server';
import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getSession } from '@/utils/auth';
import { studentStatusesApi } from '@/utils/api';

const createSchema = z.object({
  status: z.enum(['pending', 'active', 'paused', 'leave']).optional().default('pending'),
  notes: z.string().optional(),
});
export type CreateStudentStatusState = {
  success?: boolean;
  message?: string;
  fieldErrors?: Record<string, string | string[]>;
  timestamp?: number;
};
export async function createStudentStatus(prevState: CreateStudentStatusState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createStudentStatus',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const session = await getSession();
      const { studentUuid, ...data } = Object.fromEntries(formData.entries());

      const state: CreateStudentStatusState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!session?.organization) {
        return state;
      }

      const validationResult = createSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      const { data: statuses } = await studentStatusesApi.listByStudent(studentUuid as string);
      const lastStatus = statuses[0];

      if (lastStatus?.status === validationResult.data.status) {
        state.message = '현재 상태와 동일합니다.';
        return state;
      }

      await studentStatusesApi.create(studentUuid as string, {
        status: validationResult.data.status,
        notes: validationResult.data.notes,
      });

      revalidatePath('/students/[studentUuid]', 'page');
      state.success = true;
      state.message = '수강생의 상태를 변경하였습니다';
      return state;
    },
  );
}

const updateSchema = z.object({
  studentStatusUuid: z.string(),
  notes: z.string().optional(),
});

export type UpdateStudentStatusState = {
  success?: boolean;
  message?: string;
  fieldErrors?: Record<string, string | string[]>;
  timestamp?: number;
};

export async function updateStudentStatus(prevState: UpdateStudentStatusState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateStudentStatus',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const session = await getSession();

      const state: UpdateStudentStatusState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!session?.organization) {
        return state;
      }

      const validationResult = updateSchema.safeParse(Object.fromEntries(formData));
      if (!validationResult.success) {
        state.fieldErrors = validationResult.error.flatten().fieldErrors;
        return state;
      }

      await studentStatusesApi.update(validationResult.data.studentStatusUuid, {
        notes: validationResult.data.notes,
      });

      revalidatePath('/students/[studentUuid]', 'page');
      state.success = true;
      state.message = '수정하였습니다';
      return state;
    },
  );
}
