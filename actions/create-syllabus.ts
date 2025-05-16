'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { createClient } from '@/utils/supabase';
import { prisma } from '@/utils/prisma';

export async function createSyllabus(formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createSyllabus',
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

      const studentId = Number(formData.get('studentId'));
      const student = await prisma.student.findUnique({
        where: {
          id: studentId,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!student) {
        return { success: false };
      }

      const result = await prisma.syllabus.create({
        data: {
          title: (formData.get('title') as string) || '',
          notes: (formData.get('notes') as string) || '',
          studentId: student.id,
        },
      });

      revalidatePath('/syllabuses', 'page');
      return { success: true };
    },
  );
}
