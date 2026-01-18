'use client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

import * as React from 'react';
import { CircleIcon, CircleCheckBigIcon, CheckCircle2Icon, AlertCircleIcon } from 'lucide-react';

interface Props {
  lesson: {
    title: string;
    notes: string;
    student?: {
      name: string;
      nextPaymentAt: Date | null;
    } | null;
    payment?: {
      id: number;
    } | null;
    sessions: Array<{
      id: number;
      notes: string;
      sessionAt: Date;
      isDone: boolean;
      feedback?: {
        id: number;
        notes: string | null;
      } | null;
    }>;
  };
};

export default function LessonView({ lesson }: Props) {
  const completedCount = lesson.sessions.filter(l => l.isDone).length;
  const totalCount = lesson.sessions.length;
  const isPaid = !!lesson.payment;

  return (
    <div className="bg-white py-4 border border-gray-100 rounded-xl shadow-sm">
      <div className="px-4 flex items-center justify-between">
        <p className="text-lg font-bold">{lesson.student?.name}</p>
        {isPaid
          ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle2Icon className="size-3.5" />
                결제완료
              </span>
            )
          : (
              <div className="flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  <AlertCircleIcon className="size-3.5" />
                  결제필요
                </span>
                {lesson.student?.nextPaymentAt && (
                  <span className="text-xs text-gray-500">
                    다음결제예정일:
                    {' '}
                    {format(lesson.student.nextPaymentAt, 'M월 d일', { locale: ko })}
                  </span>
                )}
              </div>
            )}
      </div>
      <hr className="my-4 h-px border-none w-full bg-gray-200" />
      {lesson.sessions.length > 0
        ? (
            <div>
              <ul className="px-5 space-y-3">
                {lesson.sessions.map(session => (
                  <li key={session.id} className="flex items-start gap-2">
                    <div className="size-6 flex items-center justify-center flex-shrink-0">
                      {session.isDone
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
                        {format(session.sessionAt, 'yyyy-MM-dd HH:mm', { locale: ko })}
                      </p>
                      {session.feedback?.notes && (
                        <div className="mt-2 pl-3 border-l-2 border-blue-300">
                          <p className="text-xs text-blue-600 font-medium">피드백</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {session.feedback.notes}
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
