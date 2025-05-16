'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/utils/supabase';
import { prisma } from '@/utils/prisma';
import { parseZonedDateTime } from '@internationalized/date';

export async function updatePayment(formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updatePayment',
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

      let payment = await prisma.payment.findUnique({
        where: {
          syllabusId: syllabus.id,
        },
      });

      if (payment) {
        payment = await prisma.payment.update({
          where: {
            id: payment.id,
          },
          data: {
            amount: Number(formData.get('amount').replaceAll(',', '')),
            paidAt: parseZonedDateTime(formData.get('paidAt') as string).toDate(),
            paymentMethod: formData.get('paymentMethod'),
            notes: formData.get('notes'),
            deletedAt: null,
            updatedAt: new Date(),
          },
        });
      }
      else {
        payment = await prisma.payment.create({
          data: {
            amount: Number(formData.get('amount').replaceAll(',', '')),
            paidAt: parseZonedDateTime(formData.get('paidAt') as string).toDate(),
            paymentMethod: formData.get('paymentMethod'),
            notes: formData.get('notes'),
            syllabusId: syllabus.id,
          },
        });
      }

      revalidatePath('/syllabuses', 'page');
      revalidatePath('/payments', 'page');
      return { success: true };
    },
  );
}
