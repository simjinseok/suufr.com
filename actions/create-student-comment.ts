'use server';

import { prisma } from '@/utils/prisma';
import { createClient } from '@/utils/supabase';
import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';

export async function createStudentComment(formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createStudentComment',
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

      const studentId = Number(formData.get('studentId'));
      const content = (formData.get('content') as string) || '';

      // 학생이 현재 사용자의 것인지 확인
      const student = await prisma.student.findFirst({
        where: {
          id: studentId,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!student) {
        throw new Error('Student not found');
      }

      const comment = await prisma.studentComment.create({
        data: {
          content,
          studentId,
        },
      });

      return comment;
    },
  );
}
