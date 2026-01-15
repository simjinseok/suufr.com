'use server';
import type { ServerActionState } from '@/types/index';

import { parseDate } from '@internationalized/date';
import { z } from 'zod';
import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

const updateScheme = z.object({
  amount: z.coerce.number().min(0),
  paymentMethod: z.enum(['card', 'transfer', 'cash', 'none']),
  paidAt: z.string().transform((val, ctx) => {
    console.log('머몬', val);
    try {
      return parseDate(val).toDate('Asia/Seoul');
    }
    catch {
      ctx.addIssue({
        format: 'date',
        code: 'invalid_format',
        message: '유효하지 않은 날짜입니다',
      });

      return false;
    }
  }),
  notes: z.string().trim(),
});
type UpdatePaymentState = ServerActionState<{
  amount: number;
  paidAt: string;
  paymentMethod: string;
  notes: string;
}>;
export async function updatePayment(prevState: UpdatePaymentState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updatePayment',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { lessonId, ...data } = Object.fromEntries(formData.entries());

      const state: UpdatePaymentState = {
        success: false,
        fields: {
          amount: Number(data.amount as string),
          paidAt: data.paidAt as string,
          paymentMethod: data.paymentMethod as string,
          notes: data.notes as string,
        },
        timestamp: Date.now(),
      };

      const validationResult = updateScheme.safeParse(data);

      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      const { user } = await getSession();

      if (!user) {
        state.message = '로그인이 필요합니다';
        return state;
      }

      const lesson = await prisma.lesson.findUnique({
        where: {
          id: Number(lessonId),
          deletedAt: null,
          student: {
            userId: user.id,
          },
        },
      });

      if (!lesson) {
        state.message = '존재하지 않는 레슨입니다.';
        return state;
      }

      let payment = await prisma.payment.findUnique({
        where: {
          lessonId: lesson.id,
        },
      });

      if (payment) {
        payment = await prisma.payment.update({
          where: {
            id: payment.id,
          },
          data: {
            ...validationResult.data,
            deletedAt: null,
            updatedAt: new Date(),
          },
        });
      }
      else {
        payment = await prisma.payment.create({
          data: {
            lessonId: lesson.id,
            ...validationResult.data,
          },
        });
      }

      revalidatePath('/lessons', 'page');
      revalidatePath('/payments', 'page');
      state.success = true;
      state.message = '입금내역을 수정하였습니다.';
      return state;
    },
  );
}


export async function removePayment(prevState: any, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'removePayment',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const lessonId = Number(formData.get('lessonId'));

      const { user } = await getSession();

      if (!user) {
        return { success: false };
      }

      const lesson = await prisma.lesson.findUnique({
        where: {
          id: lessonId,
          deletedAt: null,
          student: {
            userId: user.id,
          },
        },
      });

      if (!lesson) {
        return { success: false };
      }

      const payment = await prisma.payment.findUnique({
        where: {
          lessonId: lesson.id,
        },
      });

      if (!payment) {
        return { success: false };
      }

      const result = await prisma.payment.update({
        where: {
          id: payment.id,
          lesson: {
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

      revalidatePath('/lessons', 'page');
      revalidatePath('/payments', 'page');
      return { success: true, timestamp: Date.now() };
    },
  );
}
