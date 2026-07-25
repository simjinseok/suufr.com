import { apiClient } from '../api-client';

// 미수 학생 — 학생 단위 잔액 파생 (미수액 = Σ청구액 − Σ양수입금, 환불은 미수를 만들지 않음)
type UnpaidStudent = {
  uuid: string;
  name: string;
  outstandingAmount: number;
};

type UncheckedMeeting = {
  uuid: string;
  name: string;
  phone: string | null;
  notes: string | null;
  meetingAt: string;
};

type DashboardData = {
  activeStudentCount: number;
  unpaidStudents: UnpaidStudent[];
  unpaidStudentsCount: number;
  leftStudentsCount: number;
  uncheckedMeetings: UncheckedMeeting[];
  uncheckedMeetingsCount: number;
};

type DashboardResponse = {
  success: boolean;
  data: DashboardData;
};

type DashboardParams = {
  organizationId?: number;
};

export const dashboardApi = {
  get: (params?: DashboardParams) =>
    apiClient<DashboardResponse>('/api/dashboard', { params }),
};
