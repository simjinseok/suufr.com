'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { ServerActionState, TUserSettings } from '@/types/index';
import { settingsApi } from '@/utils/api/settings';

export async function getUserSettings(): Promise<TUserSettings> {
  try {
    const response = await settingsApi.get();
    return {
      userId: response.data.userId,
      use24HourFormat: response.data.use24HourFormat,
      defaultDuration: response.data.defaultDuration,
      autoUpdateNextPaymentAt: response.data.autoUpdateNextPaymentAt,
    };
  }
  catch {
    return {
      userId: '',
      use24HourFormat: false,
      defaultDuration: 50,
      autoUpdateNextPaymentAt: true,
    };
  }
}

type UpdateSettingsState = ServerActionState<{
  use24HourFormat: boolean;
  defaultDuration: number;
  autoUpdateNextPaymentAt: boolean;
}>;

const updateSettingsSchema = z.object({
  use24HourFormat: z.coerce.boolean(),
  defaultDuration: z.coerce.number().min(1, { message: '1분 이상이어야 합니다' }).max(480, { message: '480분 이하여야 합니다' }),
  autoUpdateNextPaymentAt: z.coerce.boolean(),
});

export async function updateSettings(prevState: UpdateSettingsState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateSettings',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const data = Object.fromEntries(formData.entries());

      const state: UpdateSettingsState = {
        success: false,
        fields: {
          use24HourFormat: data.use24HourFormat === 'on',
          defaultDuration: Number(data.defaultDuration),
          autoUpdateNextPaymentAt: data.autoUpdateNextPaymentAt === 'on',
        },
        timestamp: Date.now(),
      };

      const validationResult = updateSettingsSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      try {
        await settingsApi.update({
          use24HourFormat: validationResult.data.use24HourFormat,
          defaultDuration: validationResult.data.defaultDuration,
          autoUpdateNextPaymentAt: validationResult.data.autoUpdateNextPaymentAt,
        });

        revalidatePath('/settings', 'page');
        revalidatePath('/calendar', 'page');
        revalidatePath('/students', 'layout');
        state.success = true;
        state.message = '설정을 저장하였습니다';
        return state;
      }
      catch {
        state.message = '설정 저장에 실패했습니다';
        return state;
      }
    },
  );
}
