'use server';
import type { ServerActionState } from '@/types/index';

import { parseDate } from '@internationalized/date';
import { z } from 'zod';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { paymentsApi } from '@/utils/api/payments';
import { getUserSettings } from '@/utils/user-settings';
import { DEFAULT_TIMEZONE } from '@/utils/timezone';

const updateScheme = (timeZone: string) => z.object({
  // 음수 = 환불, 0원은 기록 불가
  amount: z.coerce.number().int().refine(v => v !== 0, { error: '0원은 기록할 수 없습니다' }),
  method: z.enum(['card', 'transfer', 'cash', 'none']),
  // 입금일은 유저 설정 타임존의 그 날짜 자정 instant로 저장
  paidAt: z.string().transform((val, ctx) => {
    try {
      return parseDate(val).toDate(timeZone);
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
  method: string;
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
      const { studentUuid, paymentUuid, ...data } = Object.fromEntries(formData.entries());

      const state: UpdatePaymentState = {
        success: false,
        fields: {
          amount: Number(data.amount as string),
          paidAt: data.paidAt as string,
          method: data.method as string,
          notes: data.notes as string,
        },
        timestamp: Date.now(),
      };

      const settings = await getUserSettings();
      const validationResult = updateScheme(settings.timezone ?? DEFAULT_TIMEZONE).safeParse(data);

      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      try {
        const paymentData = {
          amount: validationResult.data.amount,
          method: validationResult.data.method,
          paidAt: (validationResult.data.paidAt as Date).toISOString(),
          notes: validationResult.data.notes,
        };

        if (paymentUuid) {
          await paymentsApi.update(paymentUuid as string, paymentData);
        }
        else {
          await paymentsApi.create({
            studentUuid: studentUuid as string,
            ...paymentData,
          });
        }

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

type RemovePaymentState = {
  success: boolean;
  message?: string;
  timestamp: number;
};
export async function removePayment(prevState: RemovePaymentState, formData: FormData): Promise<RemovePaymentState> {
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
