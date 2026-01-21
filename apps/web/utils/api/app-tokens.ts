import { apiClient } from '../api-client';

type AppToken = {
  uuid: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
};

type ListResponse = {
  success: boolean;
  data: AppToken[];
};

type CreateResponse = {
  success: boolean;
  data: {
    uuid: string;
    name: string;
    createdAt: string;
    token: string;
  };
};

export const appTokensApi = {
  list: () =>
    apiClient<ListResponse>('/api/app-tokens'),

  create: (data: { name: string }) =>
    apiClient<CreateResponse>('/api/app-tokens', { method: 'POST', body: data }),

  remove: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/app-tokens/${uuid}`, { method: 'DELETE' }),
};
