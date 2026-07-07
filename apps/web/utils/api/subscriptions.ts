import { apiClient } from '../api-client';
import type { TSubscription } from '@/types/index';

type SubscriptionResponse = {
  success: boolean;
  data: TSubscription;
};

export const subscriptionsApi = {
  get: () => apiClient<SubscriptionResponse>('/api/subscription'),
  activate: (authKey: string) =>
    apiClient<{ success: boolean }>('/api/subscription/billing/activate', {
      method: 'POST',
      body: { authKey },
    }),
  cancel: () =>
    apiClient<{ success: boolean }>('/api/subscription/cancel', {
      method: 'POST',
    }),
  resume: () =>
    apiClient<{ success: boolean }>('/api/subscription/resume', {
      method: 'POST',
    }),
};
