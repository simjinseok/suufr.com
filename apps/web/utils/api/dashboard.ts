import { apiClient } from '../api-client';

// 미수 학생 — 학생 단위 잔액 파생 (미수액 = Σ청구액 − Σ양수입금, 환불은 미수를 만들지 않음)
type UnpaidStudent = {
  uuid: string;
  name: string;
  outstandingAmount: number;
};

// "금액 미입력" 청구(price=0) — 잔액에 잡히지 않으므로 별도 노출
type NeedsPriceInvoice = {
  uuid: string;
  title: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  student: {
    uuid: string;
    name: string;
  };
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
  needsPriceInvoices: NeedsPriceInvoice[];
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
