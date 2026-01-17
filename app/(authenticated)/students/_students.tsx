'use client';
import type { Student } from '@/types/index';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

import Link from 'next/link';
import React from 'react';
import { Avatar, Chip } from '@heroui/react';
import { ChevronRightIcon } from 'lucide-react';
import StatusBadge from '@/components/status-badge';

export default function Students({ students }: { students: Student[] }) {
  if (students.length === 0) {
    return (
      <div className="mt-5 py-12 text-center text-zinc-500">
        수강생이 없어요
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-2">
      {students.map(student => (
        <Link
          key={student.id}
          href={`/students/${student.id}`}
          className="w-full flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm"
        >
          {/* 아바타 */}
          <Avatar>
            <Avatar.Fallback>{student.name.charAt(student.name.length - 1)}</Avatar.Fallback>
          </Avatar>

          {/* 정보 영역 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold truncate">
                {student.name}
              </span>
              <StatusBadge
                status={student.status as 'active' | 'pending' | 'paused' | 'leave'}
                size="sm"
              />
            </div>
            <p className="text-xs text-zinc-500">
              {student.lastSessionDate && (
                <Chip size="sm" color="default" variant="tertiary">
                  최근&nbsp;
                  {format(new Date(student.lastSessionDate), 'M월 d일', { locale: ko })}
                  {student.nextSessionDate && ' · '}
                </Chip>
              )}
              {student.nextSessionDate && (
                <Chip size="sm" color="default" variant="tertiary">
                  다음&nbsp;
                  <span className="text-primary-600 font-medium">
                    {format(new Date(student.nextSessionDate), 'M월 d일', { locale: ko })}
                  </span>
                </Chip>
              )}
              {!student.lastSessionDate && !student.nextSessionDate && '수업 없음'}
            </p>
          </div>

          {/* 화살표 */}
          <ChevronRightIcon className="w-5 h-5 text-zinc-300 flex-shrink-0" />
        </Link>
      ))}
    </div>
  );
}
