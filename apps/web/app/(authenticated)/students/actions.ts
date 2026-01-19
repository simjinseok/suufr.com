'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';

import { createClient } from '@/utils/supabase';
import prisma from '@/utils/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1),
  status: z.string(),
  notes: z.string(),
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

      const result = await prisma.student.create({
        data: {
          userId: user.id,
          ...validationResult.data,
        },
      });

      revalidatePath('/students', 'page');
      return { success: true };
    },
  );
}
