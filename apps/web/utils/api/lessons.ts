import { apiClient } from '../api-client';

type Session = {
  id: number;
  uuid: string;
  sessionAt: string;
  duration: number;
  notes: string;
  isDone: boolean;
  feedback?: {
    id: number;
    notes: string;
  } | null;
};

type Student = {
  id: number;
  uuid: string;
  name: string;
};

type Payment = {
  id: number;
  uuid: string;
  amount: number;
  paymentMethod: string;
  paidAt: string | null;
  notes: string | null;
};

type Share = {
  id: number;
  shareId: string;
  expiresAt: string;
};

type Lesson = {
  id: number;
  uuid: string;
  title: string;
  notes: string;
  student: Student;
  sessions: Session[];
  payment?: Payment | null;
  shares?: Share[];
};

type ListLessonsParams = {
  organizationUuids?: string[];
  page?: number;
  limit?: number;
  studentUuid?: string;
};

type ListLessonsResponse = {
  success: boolean;
  data: Lesson[];
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
};

type LessonResponse = {
  success: boolean;
  data: Lesson;
};

type CreateSessionData = {
  sessionAt: string;
  duration?: number;
  notes?: string;
};

type CreateLessonData = {
  title: string;
  notes?: string;
  studentUuid: string;
  sessions?: CreateSessionData[];
};

type UpdateLessonData = {
  title?: string;
  notes?: string;
};

type ShareResponse = {
  success: boolean;
  data: {
    shareId: string;
    expiresAt: string;
  };
};

type SharedLessonOrganization = {
  name: string;
  logoImageKey: string | null;
  logoImageUrl: string | null;
  profileName: string | null;
  profileImageKey: string | null;
  profileImageUrl: string | null;
};

type SharedLessonSession = {
  id: number;
  uuid: string;
  sessionAt: string;
  duration: number;
  notes: string;
  isDone: boolean;
  feedback: {
    id: number;
    notes: string;
  } | null;
};

type SharedLesson = {
  id: number;
  uuid: string;
  title: string;
  notes: string;
  student: {
    name: string;
    nextPaymentAt: string | null;
    organization: SharedLessonOrganization;
  };
  payment: { id: number }[] | null;
  sessions: SharedLessonSession[];
};

type SharedLessonResponse = {
  success: boolean;
  data: {
    lesson: SharedLesson;
    expiresAt: string;
  };
};

export const lessonsApi = {
  list: (params: ListLessonsParams) =>
    apiClient<ListLessonsResponse>('/api/lessons', { params }),

  get: (uuid: string) =>
    apiClient<LessonResponse>(`/api/lessons/${uuid}`),

  getByShareId: (shareId: string) =>
    apiClient<SharedLessonResponse>(`/api/lessons/share/${shareId}`),

  create: (data: CreateLessonData) =>
    apiClient<LessonResponse>('/api/lessons', { method: 'POST', body: data }),

  update: (uuid: string, data: UpdateLessonData) =>
    apiClient<LessonResponse>(`/api/lessons/${uuid}`, { method: 'PATCH', body: data }),

  remove: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/lessons/${uuid}`, { method: 'DELETE' }),

  createShare: (uuid: string) =>
    apiClient<ShareResponse>(`/api/lessons/${uuid}/share`, { method: 'POST' }),

  deleteShare: (uuid: string, shareId: string) =>
    apiClient<{ success: boolean }>(`/api/lessons/${uuid}/share/${shareId}`, { method: 'DELETE' }),
};
