import { apiClient } from '../api-client';

type Organization = {
  id: number;
  uuid: string;
  name: string;
  phone: string | null;
  address: string | null;
  logoImageKey: string | null;
  profileName: string | null;
  profileImageKey: string | null;
};

type ListOrganizationsResponse = {
  success: boolean;
  data: Organization[];
};

type OrganizationResponse = {
  success: boolean;
  data: Organization;
};

type UpdateOrganizationData = {
  name?: string;
  phone?: string;
  address?: string;
  profileName?: string;
  profileImageKey?: string;
};

export const organizationsApi = {
  list: () =>
    apiClient<ListOrganizationsResponse>('/api/organizations'),

  get: (uuid: string) =>
    apiClient<OrganizationResponse>(`/api/organizations/${uuid}`),

  update: (uuid: string, data: UpdateOrganizationData) =>
    apiClient<OrganizationResponse>(`/api/organizations/${uuid}`, { method: 'PATCH', body: data }),
};
