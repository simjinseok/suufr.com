import { apiClient } from '../api-client';
import type { TSubscription } from '@/types/index';

type SubscriptionResponse = {
  success: boolean;
  data: TSubscription;
};

export const subscriptionsApi = {
  get: (organizationUuid: string) =>
    apiClient<SubscriptionResponse>('/api/subscription', {
      params: { organizationUuid },
    }),
  activate: (organizationUuid: string, authKey: string) =>
    apiClient<{ success: boolean }>('/api/subscription/billing/activate', {
      method: 'POST',
      body: { organizationUuid, authKey },
    }),
  cancel: (organizationUuid: string) =>
    apiClient<{ success: boolean }>('/api/subscription/cancel', {
      method: 'POST',
      body: { organizationUuid },
    }),
  resume: (organizationUuid: string) =>
    apiClient<{ success: boolean }>('/api/subscription/resume', {
      method: 'POST',
      body: { organizationUuid },
    }),
};
