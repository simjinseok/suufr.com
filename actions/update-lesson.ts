'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { parseZonedDateTime } from '@internationalized/date';
import { createClient } from '@/utils/supabase';
import { prisma } from '@/utils/prisma';

export async function updateLesson(formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateLesson',
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
        return { success: false };
      }

      const lessonId = Number(formData.get('lessonId'));

      const lesson = await prisma.lesson.findUnique({
        where: {
          id: lessonId,
          deletedAt: null,
          syllabus: {
            student: {
              userId: user.id,
            },
          },
        },
      });

      if (!lesson) {
        return new Response('', {
          status: 404,
        });
      }

      const lessonAt = parseZonedDateTime(formData.get('lessonAt') as string).toDate();
      const result = await prisma.lesson.update({
        where: {
          id: lesson.id,
        },
        data: {
          isDone: formData.has('isDone'),
          notes: formData.get('notes') as string,
          lessonAt,
          updatedAt: new Date(),
        },
      });

      revalidatePath('/lessons', 'page');
      revalidatePath('/syllabuses', 'page');
      return { success: true };
    },
  );
}
