'use server';
import * as Sentry from '@sentry/nextjs';

import { z } from 'zod';
import { createClient } from '@/utils/supabase';
import { prisma } from '@/utils/prisma';

import { headers } from 'next/headers';
import {revalidatePath} from "next/cache";

const schema = z.object({
  name: z.string().min(1),
  notes: z.string(),
});
export async function updateStudent(formData: FormData) {
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

      const validationResult = schema.safeParse(Object.fromEntries(formData));
      if (!validationResult.success) {
        return { success: false, errors: validationResult.error.flatten().fieldErrors };
      }

      const result = await prisma.student.update({
        where: {
          id: student.id,
        },
        data: {
          ...validationResult.data,
          updatedAt: new Date(),
        },
      });

      revalidatePath('/students', 'page');
      return { success: true };
    },
  );
}
