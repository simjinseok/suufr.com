import { apiClient } from '../api-client';

type Organization = {
  id: number;
  uuid: string;
  name: string;
  phone: string | null;
  address: string | null;
  logoImageKey: string | null;
  role?: 'owner' | 'teacher';
};

type Member = {
  id: number;
  uuid: string;
  name: string;
  role: 'owner' | 'teacher';
  status: 'active' | 'paused' | 'leave';
  userId: string | null;
};

type OrganizationWithMembers = Organization & {
  members: Member[];
};

type ListOrganizationsResponse = {
  success: boolean;
  data: Organization[];
};

type OrganizationResponse = {
  success: boolean;
  data: OrganizationWithMembers;
};

type UpdateOrganizationData = {
  name?: string;
  phone?: string;
  address?: string;
};

type SwitchOrganizationResponse = {
  success: boolean;
  data: {
    organization: Organization;
    member: Member;
  };
};

export const organizationsApi = {
  list: () =>
    apiClient<ListOrganizationsResponse>('/api/organizations'),

  get: (uuid: string) =>
    apiClient<OrganizationResponse>(`/api/organizations/${uuid}`),

  update: (uuid: string, data: UpdateOrganizationData) =>
    apiClient<OrganizationResponse>(`/api/organizations/${uuid}`, { method: 'PATCH', body: data }),

  switch: (uuid: string) =>
    apiClient<SwitchOrganizationResponse>(`/api/organizations/${uuid}/switch`, { method: 'POST' }),
};
