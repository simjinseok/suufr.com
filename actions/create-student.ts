'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { createClient } from '@/utils/supabase';
import { prisma } from '@/utils/prisma';
const createSchema = z.object({
  name: z.string().min(1),
  notes: z.string(),
  status: z.enum(['pending', 'active', 'paused', 'leave']).optional().default('pending'),
});
export async function createStudent(formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createStudent',
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

      const validationResult = createSchema.safeParse(Object.fromEntries(formData));
      if (!validationResult.success) {
        return { success: false, errors: validationResult.error.flatten().fieldErrors };
      }

      await prisma.$transaction(async (tx) => {
        const student = await tx.student.create({
          data: {
            userId: user.id,
            ...validationResult.data,
          },
        });

        await tx.studentStatusHistory.create({
          data: {
            studentId: student.id,
            status: validationResult.data.status,
            notes: '신규 수강생 등록',
          },
        });

        return student;
      });

      revalidatePath('/students', 'page');
      return { success: true };
    },
  );
}
