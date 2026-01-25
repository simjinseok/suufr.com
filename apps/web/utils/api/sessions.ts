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
  lesson: Lesson;
  feedback?: Feedback | null;
  sessionMediaFiles?: SessionMediaFile[];
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

type CreateMediaFileData = {
  url: string;
  publicId: string;
  type: 'image' | 'video';
  fileName?: string;
  fileSize: number;
};

type CreateSessionData = {
  lessonUuid: string;
  sessionAt: string;
  duration?: number;
  notes?: string;
  newMediaFiles?: CreateMediaFileData[];
  existingMediaFileUuids?: string[];
};

type UpdateSessionData = {
  sessionAt?: string;
  duration?: number;
  notes?: string;
  isDone?: boolean;
  addNewMediaFiles?: CreateMediaFileData[];
  addExistingMediaFileUuids?: string[];
  removeMediaFileUuids?: string[];
};

type FeedbackMediaFile = {
  id: number;
  feedbackId: number;
  mediaFileId: number;
  mediaFile: MediaFile;
};

type FeedbackWithMediaFiles = Feedback & {
  feedbackMediaFiles?: FeedbackMediaFile[];
};

type FeedbackResponse = {
  success: boolean;
  data: FeedbackWithMediaFiles;
};

type UpsertFeedbackData = {
  notes: string;
  addNewMediaFiles?: CreateMediaFileData[];
  addExistingMediaFileUuids?: string[];
  removeMediaFileUuids?: string[];
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

  upsertFeedback: (uuid: string, data: UpsertFeedbackData) =>
    apiClient<FeedbackResponse>(`/api/sessions/${uuid}/feedback`, { method: 'POST', body: data }),

  deleteFeedback: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/sessions/${uuid}/feedback`, { method: 'DELETE' }),
};
