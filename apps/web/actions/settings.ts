'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { ServerActionState } from '@/types/index';
import { settingsApi } from '@/utils/api/settings';
import { getUserSettings } from '@/utils/user-settings';
import { isValidTimeZone } from '@/utils/timezone';
import { PAYMENT_METHODS, type PaymentMethod } from '@/constants/payment-method';

/**
 * 브라우저 타임존으로 설정을 1회 초기화 (설정이 비어 있을 때만 호출됨).
 */
export async function initializeTimezone(timezone: string): Promise<void> {
  return await Sentry.withServerActionInstrumentation(
    'initializeTimezone',
    { headers: await headers(), recordResponse: true },
    async () => {
      if (!isValidTimeZone(timezone)) return;

      const current = await getUserSettings();
      if (current.timezone) return; // 이미 설정됨 — 덮어쓰지 않는다

      await settingsApi.update({ timezone });
      revalidatePath('/', 'layout');
    },
  );
}

type UpdateSettingsState = ServerActionState<{
  use24HourFormat: boolean;
  defaultDuration: number;
  autoUpdateNextPaymentAt: boolean;
  timezone: string;
  defaultPaymentMethod: PaymentMethod | '';
}>;

// 스위치(checkbox)는 켜졌을 때만 'on' 으로 실리고 꺼지면 키 자체가 없다.
// zod v4 의 z.coerce.boolean() 은 undefined 를 거부하므로 "없음 = false" 로 직접 해석한다.
const formSwitch = z.literal('on').optional().transform(value => value === 'on');

const updateSettingsSchema = z.object({
  use24HourFormat: formSwitch,
  defaultDuration: z.coerce.number().min(1, { message: '1분 이상이어야 합니다' }).max(480, { message: '480분 이하여야 합니다' }),
  autoUpdateNextPaymentAt: formSwitch,
  timezone: z.string().refine(isValidTimeZone, { message: '올바른 시간대를 선택해주세요' }),
  defaultPaymentMethod: z.enum(PAYMENT_METHODS, { message: '결제수단을 선택해주세요' }),
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
          timezone: String(data.timezone ?? ''),
          defaultPaymentMethod: (PAYMENT_METHODS as readonly string[]).includes(String(data.defaultPaymentMethod))
            ? (data.defaultPaymentMethod as PaymentMethod)
            : '',
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
          timezone: validationResult.data.timezone,
          defaultPaymentMethod: validationResult.data.defaultPaymentMethod,
        });

        revalidatePath('/settings', 'page');
        revalidatePath('/payments', 'page');
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
