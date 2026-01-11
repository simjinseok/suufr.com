'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/utils/supabase';
import prisma from '@/utils/prisma';
import {getSession} from "@/utils/auth";

export async function removePayment(prevState: any, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'removePayment',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const syllabusId = Number(formData.get('lessonId'));

      const supabase = await createClient();

      const { user } = await getSession();

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

      const payment = await prisma.payment.findUnique({
        where: {
          syllabusId: syllabus.id,
        },
      });

      if (!payment) {
        return { success: false };
      }

      const result = await prisma.payment.update({
        where: {
          id: payment.id,
          syllabus: {
            student: {
              userId: user.id,
            },
          },
        },
        data: {
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      revalidatePath('/syllabuses', 'page');
      revalidatePath('/payments', 'page');
      return { success: true, timestamp: Date.now() };
    },
  );
}
