import { apiClient } from '../api-client';
import type { TSubscription } from '@/types/index';

type SubscriptionResponse = {
  success: boolean;
  data: TSubscription;
};

type InvoiceResponse = {
  success: boolean;
  data: { url: string };
};

type CheckoutResponse = {
  success: boolean;
  data: { transactionId: string };
};

export const subscriptionsApi = {
  get: () => apiClient<SubscriptionResponse>('/api/subscription'),
  checkout: () =>
    apiClient<CheckoutResponse>('/api/subscription/checkout', {
      method: 'POST',
    }),
  invoice: (transactionId: string) =>
    apiClient<InvoiceResponse>(`/api/subscription/orders/${encodeURIComponent(transactionId)}/invoice`),
  cancel: () =>
    apiClient<{ success: boolean }>('/api/subscription/cancel', {
      method: 'POST',
    }),
  resume: () =>
    apiClient<{ success: boolean }>('/api/subscription/resume', {
      method: 'POST',
    }),
};
