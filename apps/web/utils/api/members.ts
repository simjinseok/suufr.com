import { apiClient } from '../api-client';

type Member = {
  id: number;
  uuid: string;
  name: string;
  role: 'owner' | 'teacher';
  status: 'active' | 'paused' | 'leave';
  profileImageKey: string | null;
  userId: string | null;
  createdAt: string;
};

type ListMembersResponse = {
  success: boolean;
  data: Member[];
};

type MemberResponse = {
  success: boolean;
  data: Member;
};

type CreateMemberData = {
  name: string;
  role?: 'owner' | 'teacher';
};

type UpdateMemberData = {
  name?: string;
  role?: 'owner' | 'teacher';
};

export const membersApi = {
  listByOrganization: (organizationUuid: string) =>
    apiClient<ListMembersResponse>(`/api/organizations/${organizationUuid}/members`),

  get: (uuid: string) =>
    apiClient<MemberResponse>(`/api/members/${uuid}`),

  create: (organizationUuid: string, data: CreateMemberData) =>
    apiClient<MemberResponse>(`/api/organizations/${organizationUuid}/members`, { method: 'POST', body: data }),

  update: (uuid: string, data: UpdateMemberData) =>
    apiClient<MemberResponse>(`/api/members/${uuid}`, { method: 'PATCH', body: data }),

  remove: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/members/${uuid}`, { method: 'DELETE' }),
};
