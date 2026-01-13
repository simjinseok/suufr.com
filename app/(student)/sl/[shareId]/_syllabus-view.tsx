'use client';

import dayjs from 'dayjs';
import { CircleIcon, CircleCheckBigIcon } from 'lucide-react';

type Props = {
  syllabus: {
    title: string;
    notes: string;
    lessons: Array<{
      id: number;
      notes: string;
      lessonAt: Date;
      isDone: boolean;
      feedback?: {
        id: number;
        notes: string | null;
      } | null;
    }>;
  };
};

export default function SyllabusView({ syllabus }: Props) {
  const completedCount = syllabus.lessons.filter(l => l.isDone).length;
  const totalCount = syllabus.lessons.length;

  return (
    <div className="bg-white py-4 border border-gray-100 rounded-xl shadow-sm">
      <div className="px-4">
        <p className="text-lg font-bold">{syllabus.student?.name}</p>
      </div>
      <hr className="my-4 h-px border-none w-full bg-gray-200" />
      {syllabus.lessons.length > 0
        ? (
            <div>
              <ul className="px-5 space-y-3">
                {syllabus.lessons.map(lesson => (
                  <li key={lesson.id} className="flex items-start gap-2">
                    <div className="size-6 flex items-center justify-center flex-shrink-0">
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
                    </div>
                    <div className="flex-1">
                      <p className="tabular-nums font-medium">
                        {dayjs(lesson.lessonAt).format('YYYY-MM-DD HH:mm')}
                      </p>
                      {lesson.feedback?.notes && (
                        <div className="mt-2 pl-3 border-l-2 border-blue-300">
                          <p className="text-xs text-blue-600 font-medium">피드백</p>
                          <p className="text-sm text-gray-700">
                            {lesson.feedback.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <hr className="my-4 h-px border-none w-full bg-gray-200" />
              <div className="px-5">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>진행률</span>
                  <span>
                    {completedCount}
                    {' '}
                    /
                    {totalCount}
                    {' '}
                    완료
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )
        : (
            <div className="py-5 text-center text-gray-500">
              설정된 수업이 없습니다
            </div>
          )}
    </div>
  );
}
