import { apiClient } from '../api-client';
import type { PaymentMethod } from '@/constants/payment-method';

type Settings = {
  userId: string;
  use24HourFormat: boolean;
  defaultDuration: number;
  autoUpdateNextPaymentAt: boolean;
  timezone: string | null;
  defaultPaymentMethod: string; // 서버는 string 으로 내려준다 — 소비처에서 정규화
};

type SettingsResponse = {
  success: boolean;
  data: Settings;
};

type UpdateSettingsData = {
  use24HourFormat?: boolean;
  defaultDuration?: number;
  autoUpdateNextPaymentAt?: boolean;
  timezone?: string;
  defaultPaymentMethod?: PaymentMethod;
};

export const settingsApi = {
  get: () =>
    apiClient<SettingsResponse>('/api/settings'),

  update: (data: UpdateSettingsData) =>
    apiClient<SettingsResponse>('/api/settings', { method: 'PATCH', body: data }),
};
