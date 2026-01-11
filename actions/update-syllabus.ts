'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { createClient } from '@/utils/supabase';
import prisma from '@/utils/prisma';

export async function updateSyllabus(state, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateSyllabus',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const syllabusId = Number(formData.get('syllabusId'));

      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false };
      }

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

      const result = await prisma.syllabus.update({
        where: {
          id: syllabus.id,
        },
        data: {
          title: formData.get('title') as string,
          notes: formData.get('notes') as string,
          updatedAt: new Date(),
        },
      });

      revalidatePath('/syllabuses', 'page');
      return { success: true };
    },
  );
}
