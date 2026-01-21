'use server';

import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { getSession } from '@/utils/auth';
import { ServerActionState } from '@/types/index';
import { studentCommentsApi } from '@/utils/api';

type CreateStudentCommentState = ServerActionState<{
  content: string;
}>;
export async function createStudentComment(prevState: CreateStudentCommentState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createStudentComment',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const session = await getSession();

      if (!session?.organization) {
        throw new Error('Unauthorized');
      }

      const state: CreateStudentCommentState = {
        success: false,
        fields: {
          content: (formData.get('content') as string) || '',
        },
        timestamp: Date.now(),
      };
      const studentUuid = formData.get('studentUuid') as string;
      const content = (formData.get('content') as string) || '';

      await studentCommentsApi.create(studentUuid, { content });

      revalidatePath(`/students/[studentUuid]/@comments`)
      state.success = true;
      state.message = '코멘트를 작성하였습니다.';
      return state;
    },
  );
}

type UpdateStudentCommentState = ServerActionState<{
  content: string;
}>;
export async function updateStudentComment(prevState: UpdateStudentCommentState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateStudentComment',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const session = await getSession();

      if (!session?.organization) {
        throw new Error('Unauthorized');
      }

      const state: UpdateStudentCommentState = {
        success: false,
        fields: {
          content: (formData.get('content') as string) || '',
        },
        timestamp: Date.now(),
      };

      const commentUuid = formData.get('commentUuid') as string;
      const content = (formData.get('content') as string) || '';

      await studentCommentsApi.update(commentUuid, { content });

      state.success = true;
      return state;
    },
  );
}

export async function deleteStudentComment(commentUuid: string) {
  return await Sentry.withServerActionInstrumentation(
    'deleteStudentComment',
    {
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const session = await getSession();

      if (!session?.organization) {
        throw new Error('Unauthorized');
      }

      await studentCommentsApi.remove(commentUuid);

      revalidatePath(`/students/[studentUuid]/@comments`);

      return { success: true };
    },
  );
}
