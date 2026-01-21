import { apiClient } from '../api-client';

type MemberStatus = {
  id: number;
  uuid: string;
  status: 'active' | 'paused' | 'leave';
  notes: string | null;
  changedAt: string;
};

type ListMemberStatusesResponse = {
  success: boolean;
  data: MemberStatus[];
};

type MemberStatusResponse = {
  success: boolean;
  data: MemberStatus;
};

type CreateMemberStatusData = {
  status: 'active' | 'paused' | 'leave';
  notes?: string;
  changedAt?: string;
};

type UpdateMemberStatusData = {
  status?: 'active' | 'paused' | 'leave';
  notes?: string;
  changedAt?: string;
};

export const memberStatusesApi = {
  listByMember: (memberUuid: string) =>
    apiClient<ListMemberStatusesResponse>(`/api/members/${memberUuid}/statuses`),

  create: (memberUuid: string, data: CreateMemberStatusData) =>
    apiClient<MemberStatusResponse>(`/api/members/${memberUuid}/statuses`, { method: 'POST', body: data }),

  update: (uuid: string, data: UpdateMemberStatusData) =>
    apiClient<MemberStatusResponse>(`/api/member-statuses/${uuid}`, { method: 'PATCH', body: data }),
};
