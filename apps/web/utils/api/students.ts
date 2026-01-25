import { apiClient } from '../api-client';
import type { Student } from '@/types/index';

type ListStudentsParams = {
  organizationUuids?: string[];
  page?: number;
  limit?: number;
  status?: string;
  q?: string;
};

type ListStudentsResponse = {
  success: boolean;
  data: Student[];
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
};

type StudentResponse = {
  success: boolean;
  data: Student;
};

type CreateStudentData = {
  name: string;
  notes?: string;
  phone?: string;
  email?: string;
  nextPaymentAt?: string;
};

type UpdateStudentData = Partial<CreateStudentData> & {
  profileImageUrl?: string | null;
};

type StudentStats = {
  remainingSessionsCount: number;
  completedLessonCount: number;
  unpaidLessonCount: number;
  nextPaymentAt: Date | null;
};

type StudentStatsResponse = {
  success: boolean;
  data: StudentStats;
};

export const studentsApi = {
  list: (params: ListStudentsParams) =>
    apiClient<ListStudentsResponse>('/api/students', { params }),

  get: (uuid: string) =>
    apiClient<StudentResponse>(`/api/students/${uuid}`),

  getStats: (uuid: string) =>
    apiClient<StudentStatsResponse>(`/api/students/${uuid}/stats`),

  create: (organizationUuid: string, data: CreateStudentData) =>
    apiClient<StudentResponse>('/api/students', { method: 'POST', body: { ...data, organizationUuid } }),

  update: (uuid: string, data: UpdateStudentData) =>
    apiClient<StudentResponse>(`/api/students/${uuid}`, { method: 'PATCH', body: data }),

  remove: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/students/${uuid}`, { method: 'DELETE' }),
};
