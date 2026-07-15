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

type SessionInvoice = {
  uuid: string;
  title: string | null;
  price: number;
  deletedAt: string | null;
};

type MediaFile = {
  id: number;
  uuid: string;
  url: string;
  publicId: string;
  type: 'image' | 'video';
  fileName: string | null;
  fileSize: number;
};

type SessionMediaFile = {
  id: number;
  sessionId: number;
  mediaFileId: number;
  mediaFile: MediaFile;
};

type Session = {
  id: number;
  uuid: string;
  sessionAt: string;
  duration: number;
  notes: string;
  isDone: boolean;
  type: 'regular' | 'trial' | 'comp';
  student: Student;
  invoice: SessionInvoice | null;
  feedback?: Feedback | null;
  sessionMediaFiles?: SessionMediaFile[];
};

type ListSessionsParams = {
  organizationUuids?: string[];
  page?: number;
  limit?: number;
  studentUuid?: string;
  invoiceUuid?: string;
  dateFrom?: string;
  dateTo?: string;
  order?: 'asc' | 'desc';
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
  studentUuid: string;
  invoiceUuid?: string;
  sessionAt: string;
  duration?: number;
  notes?: string;
  mediaFileUuids?: string[];
};

type CreateSessionsBulkData = {
  studentUuid: string;
  invoiceUuid?: string;
  sessions: Array<{
    sessionAt: string;
    duration?: number;
    notes?: string;
  }>;
  // 마지막 수업 다음 회차 ("YYYY-MM-DD", KST) — 다음 결제 예정일 자동 갱신용
  nextPaymentAt?: string;
};

type SessionsResponse = {
  success: boolean;
  data: Session[];
};

type UpdateSessionData = {
  sessionAt?: string;
  duration?: number;
  notes?: string;
  isDone?: boolean;
  invoiceUuid?: string;
  addMediaFileUuids?: string[];
  removeMediaFileUuids?: string[];
};

type FeedbackResponse = {
  success: boolean;
  data: Feedback;
};

type UpsertFeedbackData = {
  notes: string;
};

export const sessionsApi = {
  list: (params: ListSessionsParams) =>
    apiClient<ListSessionsResponse>('/api/sessions', { params }),

  get: (uuid: string) =>
    apiClient<SessionResponse>(`/api/sessions/${uuid}`),

  create: (data: CreateSessionData) =>
    apiClient<SessionResponse>('/api/sessions', { method: 'POST', body: data }),

  createBulk: (data: CreateSessionsBulkData) =>
    apiClient<SessionsResponse>('/api/sessions/bulk', { method: 'POST', body: data }),

  update: (uuid: string, data: UpdateSessionData) =>
    apiClient<SessionResponse>(`/api/sessions/${uuid}`, { method: 'PATCH', body: data }),

  remove: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/sessions/${uuid}`, { method: 'DELETE' }),

  markDone: (uuid: string, isDone: boolean) =>
    apiClient<SessionResponse>(`/api/sessions/${uuid}/done`, { method: 'PATCH', body: { isDone } }),

  upsertFeedback: (uuid: string, data: UpsertFeedbackData) =>
    apiClient<FeedbackResponse>(`/api/sessions/${uuid}/feedback`, { method: 'POST', body: data }),

  deleteFeedback: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/sessions/${uuid}/feedback`, { method: 'DELETE' }),
};
