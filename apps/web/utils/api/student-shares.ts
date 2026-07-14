import { apiClient } from '../api-client';

type StudentShare = {
  shareId: string;
  showPayments: boolean;
  expiresAt: string;
  createdAt: string;
};

type ListStudentSharesResponse = {
  success: boolean;
  data: StudentShare[];
};

type CreateStudentShareResponse = {
  success: boolean;
  data: {
    shareId: string;
    showPayments: boolean;
    expiresAt: string;
  };
};

type SharedOrganization = {
  name: string;
  logoImageUrl: string | null;
  profileName: string | null;
  profileImageUrl: string | null;
};

type SharedSession = {
  uuid: string;
  sessionAt: string;
  duration: number;
  notes: string;
  isDone: boolean;
  type: 'regular' | 'trial' | 'comp';
  sessionMediaFiles?: Array<{
    mediaFile: {
      uuid: string;
      url: string;
      type: 'image' | 'video' | 'document';
      fileName: string | null;
    };
  }>;
  feedback: {
    notes: string;
  } | null;
};

export type SharedStudentData = {
  student: {
    name: string;
    nextPaymentAt: string | null;
    organization: SharedOrganization;
  };
  showPayments: boolean;
  hasUnpaid: boolean | null;
  sessions: SharedSession[];
  timezone: string; // 표기 기준 = 소유자(튜터)의 설정 타임존
  expiresAt: string;
};

type SharedStudentResponse = {
  success: boolean;
  data: SharedStudentData;
};

// [레거시] 구 LessonShare 공유 뷰 응답 (drop 마이그레이션 전까지 유지)
type LegacySharedLesson = {
  uuid: string;
  title: string;
  notes: string;
  student: {
    name: string;
    nextPaymentAt: string | null;
    organization: SharedOrganization & { logoImageKey: string | null };
  };
  payment: { id: number } | null;
  sessions: SharedSession[];
};

type LegacySharedLessonResponse = {
  success: boolean;
  data: {
    lesson: LegacySharedLesson;
    timezone: string; // 표기 기준 = 소유자(튜터)의 설정 타임존
    expiresAt: string;
  };
};

export const studentSharesApi = {
  listByStudent: (studentUuid: string) =>
    apiClient<ListStudentSharesResponse>('/api/student-shares', { params: { studentUuid } }),

  create: (data: { studentUuid: string; showPayments?: boolean }) =>
    apiClient<CreateStudentShareResponse>('/api/student-shares', { method: 'POST', body: data }),

  remove: (shareId: string) =>
    apiClient<{ success: boolean }>(`/api/student-shares/${shareId}`, { method: 'DELETE' }),

  getByShareId: (shareId: string) =>
    apiClient<SharedStudentResponse>(`/api/student-shares/${shareId}`),

  getByLegacyLessonShareId: (shareId: string) =>
    apiClient<LegacySharedLessonResponse>(`/api/lessons/share/${shareId}`),
};
