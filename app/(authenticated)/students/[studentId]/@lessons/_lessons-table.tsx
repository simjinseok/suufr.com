'use client';

import { format } from 'date-fns';
import { Chip } from '@heroui/react';
import { CheckCircle, Circle, MessageSquare } from 'lucide-react';

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
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              날짜
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              계획
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              메모
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              상태
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              피드백
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {lessons.map((lesson) => (
            <tr
              key={lesson.id}
              className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
            >
              <td className="py-3 px-4 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                {format(new Date(lesson.lessonAt), 'yyyy-MM-dd')}
              </td>

              <td className="py-3 px-4 text-sm font-medium text-zinc-900 dark:text-white">
                {lesson.syllabus.title}
              </td>

              <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                {lesson.notes || '-'}
              </td>

              <td className="py-3 px-4">
                {lesson.isDone ? (
                  <Chip variant="soft" color="success" size="sm">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    완료
                  </Chip>
                ) : (
                  <Chip variant="soft" color="default" size="sm">
                    <Circle className="w-3 h-3 mr-1" />
                    예정
                  </Chip>
                )}
              </td>

              <td className="py-3 px-4">
                {lesson.feedback ? (
                  <Chip variant="soft" color="accent" size="sm">
                    <MessageSquare className="w-3 h-3 mr-1" />
                    작성됨
                  </Chip>
                ) : (
                  <span className="text-zinc-400 text-sm">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
