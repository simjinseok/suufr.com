export type TStudent = {
  id: number;
  name: string;
  notes: string;
  status: string;
  upcomingLessonsCount?: number; // 남은 수업 횟수
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
}
