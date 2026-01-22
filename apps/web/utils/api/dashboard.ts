import { apiClient } from '../api-client';

type NotPaidLesson = {
  uuid: string;
  title: string;
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
  notPaidLessons: NotPaidLesson[];
  notPaidLessonsCount: number;
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
