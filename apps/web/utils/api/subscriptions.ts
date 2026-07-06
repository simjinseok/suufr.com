import { apiClient } from '../api-client';
import type { TSubscription } from '@/types/index';

type SubscriptionResponse = {
  success: boolean;
  data: TSubscription;
};

export const subscriptionsApi = {
  get: (organizationUuid?: string) =>
    apiClient<SubscriptionResponse>('/api/subscription', {
      params: { organizationUuid },
    }),
};
