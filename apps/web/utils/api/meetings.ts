import { apiClient } from '../api-client';
import type { TMeeting } from '@/types/index';

type ListMeetingsParams = {
  organizationUuids?: string[];
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
};

type ListMeetingsResponse = {
  success: boolean;
  data: TMeeting[];
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
};

type MeetingResponse = {
  success: boolean;
  data: TMeeting;
};

type CreateMeetingData = {
  organizationUuid: string;
  name: string;
  meetingAt: string;
  phone?: string;
  notes?: string;
  isDone?: boolean;
};

type UpdateMeetingData = {
  name?: string;
  meetingAt?: string;
  phone?: string;
  notes?: string;
  isDone?: boolean;
};

export const meetingsApi = {
  list: (params: ListMeetingsParams) =>
    apiClient<ListMeetingsResponse>('/api/meetings', { params }),

  get: (uuid: string) =>
    apiClient<MeetingResponse>(`/api/meetings/${uuid}`),

  create: (data: CreateMeetingData) =>
    apiClient<MeetingResponse>('/api/meetings', { method: 'POST', body: data }),

  update: (uuid: string, data: UpdateMeetingData) =>
    apiClient<MeetingResponse>(`/api/meetings/${uuid}`, { method: 'PATCH', body: data }),

  remove: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/meetings/${uuid}`, { method: 'DELETE' }),
};
