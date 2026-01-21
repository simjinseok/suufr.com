import { apiClient } from '../api-client';

type Feedback = {
  id: number;
  uuid: string;
  notes: string;
};

type Student = {
  id: number;
  uuid: string;
  name: string;
};

type Lesson = {
  id: number;
  uuid: string;
  title: string;
  student: Student;
};

type Session = {
  id: number;
  uuid: string;
  sessionAt: string;
  duration: number;
  notes: string;
  isDone: boolean;
  lesson: Lesson;
  feedback?: Feedback | null;
};

type ListSessionsParams = {
  organizationUuids?: string[];
  page?: number;
  limit?: number;
  lessonUuid?: string;
  dateFrom?: string;
  dateTo?: string;
};

type ListSessionsResponse = {
  success: boolean;
  data: Session[];
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
};

type SessionResponse = {
  success: boolean;
  data: Session;
};

type CreateSessionData = {
  lessonUuid: string;
  sessionAt: string;
  duration?: number;
  notes?: string;
};

type UpdateSessionData = {
  sessionAt?: string;
  duration?: number;
  notes?: string;
  isDone?: boolean;
};

type FeedbackResponse = {
  success: boolean;
  data: Feedback;
};

export const sessionsApi = {
  list: (params: ListSessionsParams) =>
    apiClient<ListSessionsResponse>('/api/sessions', { params }),

  get: (uuid: string) =>
    apiClient<SessionResponse>(`/api/sessions/${uuid}`),

  create: (data: CreateSessionData) =>
    apiClient<SessionResponse>('/api/sessions', { method: 'POST', body: data }),

  update: (uuid: string, data: UpdateSessionData) =>
    apiClient<SessionResponse>(`/api/sessions/${uuid}`, { method: 'PATCH', body: data }),

  remove: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/sessions/${uuid}`, { method: 'DELETE' }),

  markDone: (uuid: string, isDone: boolean) =>
    apiClient<SessionResponse>(`/api/sessions/${uuid}/done`, { method: 'PATCH', body: { isDone } }),

  upsertFeedback: (uuid: string, notes: string) =>
    apiClient<FeedbackResponse>(`/api/sessions/${uuid}/feedback`, { method: 'POST', body: { notes } }),

  deleteFeedback: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/sessions/${uuid}/feedback`, { method: 'DELETE' }),
};
