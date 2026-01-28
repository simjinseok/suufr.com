export type TUserSettings = {
  userId: string;
  use24HourFormat: boolean;
  defaultDuration: number;
  autoUpdateNextPaymentAt: boolean;
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
  payments?: TPayment[];
};

export type TStudent = Student;

export type TLesson = {
  id: number;
  uuid: string;
  title: string;
  notes: string;

  student?: TStudent;
  payment?: TPayment;
  sessions: TSession[];
  shares?: TLessonShare[];
};

export type TSession = {
  id: number;
  uuid: string;
  notes: string;
  isDone: boolean;
  sessionAt: Date;
  duration: number;
  lesson?: TLesson;
  feedback?: TFeedback;
  sessionMediaFiles?: TSessionMediaFile[];
};

export type TFeedback = {
  id: number;
  notes: string;
  session?: TSession;
};

export type TPayment = {
  id: number;
  uuid: string;
  amount: number;
  notes: string;
  paymentMethod: string;
  paidAt: Date;
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

export type TLessonShare = {
  id: number;
  shareId: string;
  lessonId: number;
  expiresAt: Date;
  createdAt: Date;
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
  mediaFiles?: TCurriculumItemMediaFile[];
};

export type TCurriculum = {
  id: number;
  uuid: string;
  title: string;
  description: string | null;
  items: TCurriculumItem[];
};
