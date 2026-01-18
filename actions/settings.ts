'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import prisma from '@/utils/prisma';
import { getSession } from '@/utils/auth';
import { ServerActionState, TimeFormat, TUserSettings } from '@/types/index';

const DEFAULT_TIME_FORMAT: TimeFormat = '24h';
const DEFAULT_DURATION = 50;
const DEFAULT_AUTO_UPDATE_NEXT_PAYMENT_AT = true;

export async function getUserSettings(userId: string): Promise<TUserSettings> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    return {
      userId,
      timeFormat: DEFAULT_TIME_FORMAT,
      defaultDuration: DEFAULT_DURATION,
      autoUpdateNextPaymentAt: DEFAULT_AUTO_UPDATE_NEXT_PAYMENT_AT,
    };
  }

  return {
    userId: settings.userId,
    timeFormat: settings.timeFormat as TimeFormat,
    defaultDuration: settings.defaultDuration,
    autoUpdateNextPaymentAt: settings.autoUpdateNextPaymentAt,
  };
}

type UpdateSettingsState = ServerActionState<{
  timeFormat: string;
  defaultDuration: number;
  autoUpdateNextPaymentAt: boolean;
}>;

const updateSettingsSchema = z.object({
  timeFormat: z.enum(['12h', '24h'], { message: '올바른 시간 형식을 선택해주세요' }),
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
          timeFormat: data.timeFormat as string,
          defaultDuration: Number(data.defaultDuration),
          autoUpdateNextPaymentAt: data.autoUpdateNextPaymentAt === 'on',
        },
        timestamp: Date.now(),
      };

      const { user } = await getSession();

      if (!user?.id) {
        return state;
      }

      const validationResult = updateSettingsSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      await prisma.userSettings.upsert({
        where: { userId: user.id },
        update: {
          timeFormat: validationResult.data.timeFormat,
          defaultDuration: validationResult.data.defaultDuration,
          autoUpdateNextPaymentAt: validationResult.data.autoUpdateNextPaymentAt,
          updatedAt: new Date(),
        },
        create: {
          userId: user.id,
          timeFormat: validationResult.data.timeFormat,
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
