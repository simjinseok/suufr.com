import { apiClient } from '../api-client';

type StudentStatus = {
  id: number;
  uuid: string;
  status: string;
  notes: string | null;
  changedAt: string;
  studentId: number;
};

type ListStatusesResponse = {
  success: boolean;
  data: StudentStatus[];
};

type StatusResponse = {
  success: boolean;
  data: StudentStatus;
};

type CreateStatusData = {
  status: string;
  notes?: string;
  changedAt?: string;
};

type UpdateStatusData = {
  status?: string;
  notes?: string;
  changedAt?: string;
};

export const studentStatusesApi = {
  listByStudent: (studentUuid: string) =>
    apiClient<ListStatusesResponse>(`/api/students/${studentUuid}/statuses`),

  create: (studentUuid: string, data: CreateStatusData) =>
    apiClient<StatusResponse>(`/api/students/${studentUuid}/statuses`, {
      method: 'POST',
      body: data,
    }),

  update: (uuid: string, data: UpdateStatusData) =>
    apiClient<StatusResponse>(`/api/student-statuses/${uuid}`, {
      method: 'PATCH',
      body: data,
    }),
};
