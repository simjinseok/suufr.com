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
  profileImageKey?: string | null;
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
  shares?: TSessionShare[];
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

export type TSessionShare = {
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
