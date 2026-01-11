'use client';
import React from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import {Chip, ListBox} from '@heroui/react';
import StatusBadge from '@/components/status-badge';
import type { Student } from '@/types/index';

export default function Students({ students }: { students: Student[] }) {
  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full">
        <thead className="bg-zinc-50 dark:bg-zinc-800/50">
          <tr>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              이름
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              상태
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              최근 수업
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              다음 수업
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              결제
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              진행률
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4">
              등록일
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {students.length > 0 ? (
            students.map((student) => (
              <tr
                key={student.id}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
              >
                <td className="py-3 px-4">
                  <Link
                    href={`/students/${student.id}`}
                    className="text-sm font-medium text-zinc-900 dark:text-white hover:underline"
                  >
                    {student.name}
                  </Link>
                </td>

                <td className="py-3 px-4">
                  <StatusBadge status={student.status} />
                </td>

                <td className="py-3 px-4 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {student.lastLessonDate ? (
                    format(new Date(student.lastLessonDate), 'yyyy-MM-dd')
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </td>

                <td className="py-3 px-4 text-sm tabular-nums">
                  {student.nextLessonDate ? (
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {format(new Date(student.nextLessonDate), 'yyyy-MM-dd')}
                    </span>
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </td>

                <td className="py-3 px-4">
                  {student.hasUnpaidLesson ? (
                    <Chip variant="soft" color="danger" size="sm">
                      결제필요
                    </Chip>
                  ) : (
                    <Chip variant="soft" color="success" size="sm">
                      완료
                    </Chip>
                  )}
                </td>

                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <progress
                      className="rounded-xl w-20 h-2"
                      max={student.sessionsCount || 0}
                      value={student.completedSessionsCount || 0}
                    />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
                      {student.completedSessionsCount || 0}
                      &nbsp;/&nbsp;
                      {student.sessionsCount || 0}
                    </span>
                  </div>
                </td>

                <td className="py-3 px-4 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {student.createdAt
                    ? format(new Date(student.createdAt), 'yyyy-MM-dd')
                    : '-'}
                </td>

              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="py-12 text-center text-zinc-500">
                수강생이 없어요
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
