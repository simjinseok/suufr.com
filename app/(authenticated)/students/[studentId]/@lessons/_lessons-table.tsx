'use client';

import { format } from 'date-fns';
import { Button, Chip, Modal } from '@heroui/react';
import { CheckCircle, Circle, CircleCheckBigIcon, CircleIcon, MessageSquare } from 'lucide-react';
import React from 'react';
import EditSessionModal from '@/components/sessions/edit-session-modal';
import UpdateFeedbackModal from '@/components/sessions/update-feedback-modal';

type Lesson = {
  id: number;
  lessonAt: Date;
  isDone: boolean;
  notes: string;
  syllabus: {
    title: string;
  };
  feedback: {
    id: number;
    notes: string | null;
  } | null;
};

type Props = {
  lessons: Lesson[];
};

export default function LessonsTable({ lessons }: Props) {
  if (lessons.length === 0) {
    return (
      <div className="py-12 text-center text-zinc-500">
        수업 내역이 없습니다
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full">
        <thead className="bg-zinc-50 dark:bg-zinc-800/50">
          <tr>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">완료</th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              날짜
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              시간
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              메모
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              피드백
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              수정
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {lessons.map(lesson => (
            <tr
              key={lesson.id}
              className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
            >
              <td className="py-3 px-4">
                {lesson.isDone
                  ? (
                      <CircleCheckBigIcon
                        width={20}
                        height={20}
                        className="text-green-600"
                      />
                    )
                  : (
                      <CircleIcon
                        width={20}
                        height={20}
                        className="text-amber-500"
                      />
                    )}
              </td>

              <td className="py-3 px-4 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                {format(new Date(lesson.lessonAt), 'yyyy-MM-dd')}
              </td>

              <td className="py-3 px-4 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                {format(new Date(lesson.lessonAt), 'hh시 mm분')}
              </td>

              <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                {lesson.notes || '-'}
              </td>

              <td className="py-3 px-4">
                {lesson.isDone ? (
                  <Modal>
                    <Button variant={lesson.feedback ? 'primary' : 'secondary'}>
                      {lesson.feedback ? '피드백 보기' : '피드백 작성'}
                    </Button>
                    <UpdateFeedbackModal lesson={lesson} />
                  </Modal>
                ) : (
                  <span className="text-sm text-zinc-400">-</span>
                )}
              </td>
              <td>
                <Modal>
                  <Button variant="primary">수정</Button>
                  <EditSessionModal
                    session={lesson}
                  />
                </Modal>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
