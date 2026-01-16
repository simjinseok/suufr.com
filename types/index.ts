export type TimeFormat = '12h' | '24h';

export type TUserSettings = {
  userId: string;
  timeFormat: TimeFormat;
  defaultDuration: number;
};

export type Student = {
  id: number;
  name: string;
  notes: string;
  status: string;
  createdAt?: Date;
  completedSessionsCount?: number;
  sessionsCount?: number;
  lastSessionDate?: Date | null;
  nextSessionDate?: Date | null;
  hasUnpaidLesson?: boolean;
  sessions?: TSession[];
  payments?: TPayment[];
};

export type TLesson = {
  id: number;
  title: string;
  notes: string;

  student?: TStudent;
  payment?: TPayment;
  sessions: TSession[];
  shares?: TSessionShare[];
};

export type TSession = {
  id: number;
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
  amount: number;
  notes: string;
  paymentMethod: string;
  paidAt: Date;
};

export type TMeeting = {
  id: number;
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
