import { apiClient } from '../api-client';

type Settings = {
  userId: string;
  use24HourFormat: boolean;
  defaultDuration: number;
  autoUpdateNextPaymentAt: boolean;
  timezone: string | null;
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
};

export const settingsApi = {
  get: () =>
    apiClient<SettingsResponse>('/api/settings'),

  update: (data: UpdateSettingsData) =>
    apiClient<SettingsResponse>('/api/settings', { method: 'PATCH', body: data }),
};
