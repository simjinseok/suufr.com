import { apiClient } from '../api-client';
import type { SessionStatus } from '../session-status';

// 미납 = 연결된 입금이 1건도 없는 수강권 (docs/schema-redesign.md §6-22). 서버가 오래된 순으로 정렬해 준다.
export type UnpaidInvoice = {
  uuid: string;
  title: string | null;
  price: number;
  periodStart: string;
  periodEnd: string | null;
  student: { uuid: string; name: string };
};

type UncheckedMeeting = {
  uuid: string;
  name: string;
  phone: string | null;
  notes: string | null;
  meetingAt: string;
};

// 유저 타임존의 오늘 수업 (시작 시각 순). 완료 여부는 시간이 아니라 status
export type TodaySession = {
  uuid: string;
  sessionAt: string;
  duration: number; // 분
  status: SessionStatus;
  student: { uuid: string; name: string };
};

type DashboardData = {
  activeStudentCount: number;
  unpaidInvoices: UnpaidInvoice[];
  unpaidInvoicesCount: number;
  leftStudentsCount: number;
  uncheckedMeetings: UncheckedMeeting[];
  uncheckedMeetingsCount: number;
  todayRemainingSessionCount: number;
  todaySessions: TodaySession[];
};

type DashboardResponse = {
  success: boolean;
  data: DashboardData;
};

type DashboardParams = {
  organizationId?: number;
};

export type MatrixRow = {
  student: { uuid: string; name: string };
  // 키 = 일(1..daysInMonth)
  // done은 결석을 포함한다
  days: Record<number, { count: number; done: number; absent: number }>;
  // 0 = 지난달부터, daysInMonth+1 = 다음 달까지(무기한 포함)
  periods: { startDay: number; endDay: number }[];
};

export type MonthMatrix = {
  month: string; // 'YYYY-MM'
  daysInMonth: number;
  today: string | null; // 그 달에 오늘이 있으면 'YYYY-MM-DD'
  rows: MatrixRow[];
};

type MonthMatrixResponse = {
  success: boolean;
  data: MonthMatrix;
};

type MonthMatrixParams = {
  month?: string;
};

export const dashboardApi = {
  get: (params?: DashboardParams) =>
    apiClient<DashboardResponse>('/api/dashboard', { params }),
  getMonth: (params: MonthMatrixParams) =>
    apiClient<MonthMatrixResponse>('/api/dashboard/month', { params }),
};
