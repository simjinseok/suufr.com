'use server';
import type { ServerActionState } from '@/types/index';

import { parseDate } from '@internationalized/date';
import { z } from 'zod';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { paymentsApi } from '@/utils/api/payments';

const updateScheme = z.object({
  amount: z.coerce.number().min(0),
  paymentMethod: z.enum(['card', 'transfer', 'cash', 'none']),
  paidAt: z.string().transform((val, ctx) => {
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
      const { lessonUuid, paymentUuid, ...data } = Object.fromEntries(formData.entries());

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

      try {
        const paymentData = {
          amount: validationResult.data.amount,
          paymentMethod: validationResult.data.paymentMethod,
          paidAt: (validationResult.data.paidAt as Date).toISOString(),
          notes: validationResult.data.notes,
        };

        if (paymentUuid) {
          await paymentsApi.update(paymentUuid as string, paymentData);
        }
        else {
          await paymentsApi.create({
            lessonUuid: lessonUuid as string,
            ...paymentData,
          });
        }

        revalidatePath('/lessons', 'page');
        revalidatePath('/payments', 'page');
        revalidatePath('/students', 'layout');
        state.success = true;
        state.message = '입금내역을 수정하였습니다.';
        return state;
      }
      catch {
        state.message = '입금내역 수정에 실패했습니다.';
        return state;
      }
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
      const paymentUuid = formData.get('paymentUuid') as string;

      if (!paymentUuid) {
        return { success: false, timestamp: Date.now() };
      }

      try {
        await paymentsApi.remove(paymentUuid);

        revalidatePath('/lessons', 'page');
        revalidatePath('/payments', 'page');
        revalidatePath('/students', 'layout');
        return { success: true, timestamp: Date.now() };
      }
      catch {
        return { success: false, timestamp: Date.now() };
      }
    },
  );
}
