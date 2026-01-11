export type Student = {
  id: number;
  name: string;
  notes: string;
  status: string;
  createdAt?: Date;
  completedSessionsCount?: number;
  sessionsCount?: number;
  lastLessonDate?: Date | null;
  nextLessonDate?: Date | null;
  hasUnpaidLesson?: boolean;
  lessons?: TLesson[];
  payments?: TPayment[];
};

export type TSyllabus = {
  id: number;
  title: string;
  notes: string;

  student?: TStudent;
  payment?: TPayment;
  lessons: TLesson[];
};

export type TLesson = {
  id: number;
  notes: string;
  isDone: boolean;
  lessonAt: Date;
  syllabus?: TSyllabus;
  feedback?: TFeedback;
};

export type TFeedback = {
  id: number;
  notes: string;
  lesson?: TLesson;
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
