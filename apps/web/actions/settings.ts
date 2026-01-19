'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import prisma from '@/utils/prisma';
import { getSession } from '@/utils/auth';
import { ServerActionState, TUserSettings } from '@/types/index';

const DEFAULT_USE_24_HOUR_FORMAT = false;
const DEFAULT_DURATION = 50;
const DEFAULT_AUTO_UPDATE_NEXT_PAYMENT_AT = true;

export async function getUserSettings(userId: string): Promise<TUserSettings> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    return {
      userId,
      use24HourFormat: DEFAULT_USE_24_HOUR_FORMAT,
      defaultDuration: DEFAULT_DURATION,
      autoUpdateNextPaymentAt: DEFAULT_AUTO_UPDATE_NEXT_PAYMENT_AT,
    };
  }

  return {
    userId: settings.userId,
    use24HourFormat: settings.use24HourFormat,
    defaultDuration: settings.defaultDuration,
    autoUpdateNextPaymentAt: settings.autoUpdateNextPaymentAt,
  };
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

      const session = await getSession();

      if (!session?.user?.id) {
        return state;
      }
      const { user } = session;

      const validationResult = updateSettingsSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      await prisma.userSettings.upsert({
        where: { userId: user.id },
        update: {
          use24HourFormat: validationResult.data.use24HourFormat,
          defaultDuration: validationResult.data.defaultDuration,
          autoUpdateNextPaymentAt: validationResult.data.autoUpdateNextPaymentAt,
          updatedAt: new Date(),
        },
        create: {
          userId: user.id,
          use24HourFormat: validationResult.data.use24HourFormat,
          defaultDuration: validationResult.data.defaultDuration,
          autoUpdateNextPaymentAt: validationResult.data.autoUpdateNextPaymentAt,
        },
      });

      revalidatePath('/settings', 'page');
      revalidatePath('/calendar', 'page');
      revalidatePath('/students', 'layout');
      state.success = true;
      state.message = '설정을 저장하였습니다';
      return state;
    },
  );
}
