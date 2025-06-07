'use server';

import { prisma } from '@/utils/prisma';
import { createClient } from '@/utils/supabase';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';

export async function updateStudentComment(formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateStudentComment',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Unauthorized');
      }

      const commentId = Number(formData.get('id'));
      const content = (formData.get('content') as string) || '';

      // 코멘트가 현재 사용자의 것인지 확인
      const existingComment = await prisma.studentComment.findFirst({
        where: {
          id: commentId,
          deletedAt: null,
        },
        include: {
          student: true,
        },
      });

      if (!existingComment) {
        throw new Error('Comment not found');
      }

      const comment = await prisma.studentComment.update({
        where: {
          id: commentId,
        },
        data: {
          content,
        },
      });

      return comment;
    },
  );
}
