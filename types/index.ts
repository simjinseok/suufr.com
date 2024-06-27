

export type TStudent = {
    id: number;
    name: string;
    notes: string;
    upcomingLessonsCount?: number; // 남은 수업 횟수
    lessons?: TLesson[];
    payments?: TPayment[];
}

export type TLesson = {
    id: number;
    notes: string;
    lessonAt: Date;
    student?: TStudent;
    feedback?: TFeedback;
}

export type TFeedback = {
    id: number;
    notes: string;
    lesson?: TLesson;
}

export type TPayment = {
    id: number;

}

