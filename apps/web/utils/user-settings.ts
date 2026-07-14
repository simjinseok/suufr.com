import { cache } from 'react';
import type { TUserSettings } from '@/types/index';
import { settingsApi } from '@/utils/api/settings';

// 서버 전용. 렌더 한 번에 레이아웃·페이지가 중복 호출해도 API GET은 1회 (React request cache)
export const getUserSettings = cache(async (): Promise<TUserSettings> => {
  try {
    const response = await settingsApi.get();
    return {
      userId: response.data.userId,
      use24HourFormat: response.data.use24HourFormat,
      defaultDuration: response.data.defaultDuration,
      autoUpdateNextPaymentAt: response.data.autoUpdateNextPaymentAt,
      timezone: response.data.timezone,
    };
  }
  catch {
    return {
      userId: '',
      use24HourFormat: false,
      defaultDuration: 50,
      autoUpdateNextPaymentAt: true,
      timezone: null,
    };
  }
});
