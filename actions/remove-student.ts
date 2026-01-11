'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';

import { createClient } from '@/utils/supabase';
import prisma from '@/utils/prisma';
import {revalidatePath} from "next/cache";

export default async function removeStudent(formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'removeStudent',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const studentId = Number(formData.get('studentId'));

      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false };
      }

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

      await prisma.student.update({
        where: {
          id: student.id,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      revalidatePath('/students', 'page');
      return {
        success: true,
      };
    },
  );
}
