import { apiClient } from '../api-client';

type Session = {
  id: number;
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

export type Invoice = {
  id: number;
  uuid: string;
  title: string | null;
  price: number;
  // 있으면 회차 수강권(잔여 관리), 없으면 기간 정액
  totalCount: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  autoRenew: boolean;
  renewDaysBefore: number;
  notes: string | null;
  student: Student;
  sessions: Session[];
  // 연결된 미삭제 입금 (§6-22 순수 연결) — 1건 이상이면 "입금 확인", 없으면 미납 표시
  payments: Array<{ uuid: string; amount: number; method: string; paidAt: string }>;
};

type ListInvoicesParams = {
  organizationUuids?: string[];
  page?: number;
  limit?: number;
  studentUuid?: string;
};

type ListInvoicesResponse = {
  success: boolean;
  data: Invoice[];
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
};

type InvoiceResponse = {
  success: boolean;
  data: Invoice;
};

type CreateSessionData = {
  sessionAt: string;
  duration?: number;
  notes?: string;
};

type CreateInvoiceData = {
  studentUuid: string;
  title?: string;
  price: number;
  totalCount?: number;
  periodStart?: string;
  periodEnd?: string;
  autoRenew?: boolean;
  renewDaysBefore?: number;
  notes?: string;
  sessions?: CreateSessionData[];
  sessionUuids?: string[];
  initialPayment?: {
    method: string;
    paidAt: string;
    amount?: number;
  };
};

type UpdateInvoiceData = {
  title?: string;
  price?: number;
  totalCount?: number;
  periodStart?: string;
  periodEnd?: string;
  autoRenew?: boolean;
  renewDaysBefore?: number;
  notes?: string;
  addSessionUuids?: string[];
  removeSessionUuids?: string[];
};

export const invoicesApi = {
  list: (params: ListInvoicesParams) =>
    apiClient<ListInvoicesResponse>('/api/invoices', { params }),

  get: (uuid: string) =>
    apiClient<InvoiceResponse>(`/api/invoices/${uuid}`),

  create: (data: CreateInvoiceData) =>
    apiClient<InvoiceResponse>('/api/invoices', { method: 'POST', body: data }),

  update: (uuid: string, data: UpdateInvoiceData) =>
    apiClient<InvoiceResponse>(`/api/invoices/${uuid}`, { method: 'PATCH', body: data }),

  remove: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/invoices/${uuid}`, { method: 'DELETE' }),
};
