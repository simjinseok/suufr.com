import type { PaymentMethod } from '@/constants/payment-method';

export type TUserSettings = {
  userId: string;
  use24HourFormat: boolean;
  defaultDuration: number;
  autoUpdateNextPaymentAt: boolean;
  timezone: string | null; // IANA. null = 미설정(첫 방문 시 브라우저 값으로 자동 초기화)
  defaultPaymentMethod: PaymentMethod; // 새 입금 폼 초기 선택값. 서버 값은 normalizePaymentMethod 로 정규화해 넣는다
};

export type Student = {
  id: number;
  uuid: string;
  name: string;
  notes: string;
  status: string;
  profileImageUrl?: string | null;
  nextPaymentAt?: Date | null;
  phone?: string | null;
  email?: string | null;
  createdAt?: Date;
  completedSessionsCount?: number;
  sessionsCount?: number;
  lastSessionDate?: Date | null;
  nextSessionDate?: Date | null;
  hasUnpaidLesson?: boolean;
  sessions?: TSession[];
};

export type TStudent = Student;

// 청구 단위 (구 Lesson+Payment를 대체, docs/schema-redesign.md 참조)
export type TInvoice = {
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

  student?: TStudent;
  sessions: TSession[];
  // 연결된 미삭제 입금 (§6-22 순수 연결) — 1건 이상이면 "입금 확인", 없으면 미납 표시
  payments?: Array<{ uuid: string; amount: number; method: string; paidAt: string }>;
};

export type TSession = {
  id: number;
  uuid: string;
  notes: string;
  isDone: boolean;
  sessionAt: Date;
  duration: number;
  type?: 'regular' | 'trial' | 'comp';
  student?: TStudent;
  invoice?: TInvoice | null;
  feedback?: TFeedback;
  sessionMediaFiles?: TSessionMediaFile[];
};

export type TFeedback = {
  id: number;
  notes: string;
  session?: TSession;
};

// 입금 1건. 음수 = 환불. 학생 직속 — 수강권과는 선택적 연결만 (§6-22)
export type TPayment = {
  id: number;
  uuid: string;
  amount: number;
  notes: string | null;
  method: string;
  paidAt: Date;
  student?: TStudent;
  invoices?: Array<{ uuid: string; title: string | null }>;
};

export type TMeeting = {
  id: number;
  uuid: string;
  name: string;
  phone: string | null;
  notes: string | null;
  isDone: boolean;
  meetingAt: Date;
};

export type TStudentShare = {
  shareId: string;
  showPayments: boolean;
  expiresAt: Date | string;
  createdAt: Date | string;
};

export type ServerActionState<T> = {
  success?: boolean;
  message?: string;
  fields?: T;
  fieldErrors?: Record<string, string | string[]>;
  timestamp?: number;
};

export type PaymentView = 'monthly' | 'yearly';

export type StudentPaymentStats = {
  id: number;
  name: string;
  count: number;
  totalAmount: number;
};

export type MonthlyPaymentStats = {
  year: number;
  month: number;
  count: number;
  totalAmount: number;
  students: StudentPaymentStats[];
};

export type YearlyPaymentStats = {
  year: number;
  count: number;
  totalAmount: number;
  months: MonthlyPaymentStats[];
  students: StudentPaymentStats[];
};

export type Organization = {
  id: number;
  uuid: string;
  name: string;
  logoUrl?: string;
  phone?: string;
  address?: string;
};

export type TAppToken = {
  uuid: string;
  name: string;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export type TFolder = {
  id: number;
  uuid: string;
  name: string;
  parentId: number | null;
  createdAt: Date;
  children?: TFolder[];
  _count?: { mediaFiles: number };
  parent?: { id: number; uuid: string; name: string } | null;
};

export type TFolderBreadcrumb = {
  id: number;
  uuid: string;
  name: string;
};

export type TMediaFile = {
  id: number;
  uuid: string;
  url: string;
  publicId: string;
  type: 'image' | 'video' | 'document';
  fileName: string | null;
  fileSize: number;
  createdAt: Date;
  isInUse?: boolean;
  folderId?: number | null;
  folder?: { id: number; uuid: string; name: string } | null;
};

export type TSessionMediaFile = {
  id: number;
  sessionId: number;
  mediaFileId: number;
  mediaFile: TMediaFile;
};

// MediaFilePicker에서 사용하는 공통 타입
export type TLessonMediaFile = {
  id: number;
  mediaFileId: number;
  mediaFile: TMediaFile;
};

export type TStorageQuota = {
  usedBytes: number;
  quotaBytes: number;
  remainingBytes: number;
};

export type TTempMediaFile = {
  url: string;
  publicId: string;
  type: 'image' | 'video' | 'document';
  contentType: string;
  fileName: string;
  fileSize: number;
};

export type TCurriculumItemMediaFile = {
  id: number;
  curriculumItemId: number;
  mediaFileId: number;
  mediaFile: TMediaFile;
};

export type TCurriculumItem = {
  id: number;
  uuid: string;
  title: string;
  description: string | null;
  sortOrder: number;
  sectionUuid: string | null;
  mediaFiles?: TCurriculumItemMediaFile[];
};

// 섹션(예: "1개월차"). items 는 섹션 안 항목을 sortOrder 순으로.
export type TCurriculumSection = {
  id: number;
  uuid: string;
  title: string;
  description: string | null;
  sortOrder: number;
  items: TCurriculumItem[];
};

export type TCurriculum = {
  id: number;
  uuid: string;
  title: string;
  description: string | null;
  items: TCurriculumItem[]; // 섹션 없는 항목만. 첫 섹션 위에 나열
  sections: TCurriculumSection[];
  // 소유 조직(프린트 헤더용). 세션의 선택 조직과 다를 수 있다
  organization: { uuid: string; name: string; phone: string | null; address: string | null };
};

export type TPlan = 'free' | 'pro';

export type TPlanLimits = {
  maxStudents: number | null;
  storageQuotaBytes: number;
};

export type TBillingProvider = 'paddle' | 'apple' | 'google' | 'manual';

// 구독을 지금 시작할 수 없는 사유 (api SubscribeBlocker 미러)
export type TSubscribeBlocker = 'email_unverified' | 'already_subscribed';

export type TSubscriptionOrder = {
  provider: TBillingProvider;
  transactionId: string;
  // 통화 최소 단위 정수 (KRW 6,900원 = 6900, USD $4.99 = 499)
  amount: number;
  currency: string;
  status: 'done' | 'failed' | 'refunded';
  failReason: string | null;
  approvedAt: string | null;
  refundedAt: string | null;
  refundedAmount: number | null;
  createdAt: string;
};

export type TSubscription = {
  plan: TPlan;
  status: 'active' | 'canceled' | 'past_due' | 'expired';
  // null = 구독 행 없음(free)
  provider: TBillingProvider | null;
  currentPeriodEnd: string | null;
  // 결제 실패 유예 만료. 있으면 이때까지 접근 유지
  gracePeriodExpiresAt: string | null;
  canceledAt: string | null;
  billingIssueDetectedAt: string | null;
  // 지금 결제를 시작할 수 있는가. false 면 subscribeBlockers 에 사유. api 배포 시차로 없으면 가능으로 간주
  canSubscribe?: boolean;
  subscribeBlockers?: TSubscribeBlocker[];
  orders: TSubscriptionOrder[];
  limits: TPlanLimits;
  usage: {
    studentCount: number | null;
    storageUsedBytes: number;
  };
  catalog: {
    free: TPlanLimits;
    pro: TPlanLimits & { priceKrw: number };
  };
};
