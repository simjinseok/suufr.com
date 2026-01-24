import { apiClient } from '../api-client';

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

type Payment = {
  id: number;
  uuid: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
  notes: string | null;
  lesson: Lesson;
};

type ListPaymentsParams = {
  organizationUuids?: string[];
  page?: number;
  limit?: number;
  year?: number;
  month?: number;
};

type ListPaymentsResponse = {
  success: boolean;
  data: Payment[];
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
};

type PaymentResponse = {
  success: boolean;
  data: Payment;
};

type CreatePaymentData = {
  lessonUuid: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
  notes?: string;
};

type UpdatePaymentData = {
  amount?: number;
  paymentMethod?: string;
  paidAt?: string;
  notes?: string;
};

type MonthlyTrendResponse = {
  success: boolean;
  data: {
    months: Array<{
      year: number;
      month: number;
      totalAmount: number;
      count: number;
    }>;
  };
};

export const paymentsApi = {
  list: (params: ListPaymentsParams) =>
    apiClient<ListPaymentsResponse>('/api/payments', { params }),

  get: (uuid: string) =>
    apiClient<PaymentResponse>(`/api/payments/${uuid}`),

  create: (data: CreatePaymentData) =>
    apiClient<PaymentResponse>('/api/payments', { method: 'POST', body: data }),

  update: (uuid: string, data: UpdatePaymentData) =>
    apiClient<PaymentResponse>(`/api/payments/${uuid}`, { method: 'PATCH', body: data }),

  remove: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/payments/${uuid}`, { method: 'DELETE' }),

  getMonthlyTrend: () =>
    apiClient<MonthlyTrendResponse>('/api/payments/stats/monthly-trend'),
};
