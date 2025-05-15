'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { createClient } from '@/utils/supabase';
import { prisma } from '@/utils/prisma';
import { parseZonedDateTime } from '@internationalized/date';

const createSchema = z.object({
  name: z.string().min(1),
  status: z.string(),
  notes: z.string(),
});
export async function createLesson(formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createLesson',
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

      const syllabusId = Number(formData.get('syllabusId'));
      const syllabus = await prisma.syllabus.findUnique({
        where: {
          id: syllabusId,
          deletedAt: null,
          student: {
            userId: user.id,
          },
        },
      });

      if (!syllabus) {
        return { success: false };
      }

      const dates = formData.getAll('lessonAt');
      if (dates.length >= 1) {
        const dates = formData.getAll('lessonAt');
        const results = await prisma.lesson.createMany({
          data: dates.map((date) => {
            const lessonAt = parseZonedDateTime(date as string).toDate();
            return {
              syllabusId: syllabus.id,
              notes: '',
              lessonAt,
            };
          }),
        });
      }

      revalidatePath('/students', 'page');
      return { success: true };
    },
  );
}
