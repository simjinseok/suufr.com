'use client';
import type { Student } from '@/types/index';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

import Link from 'next/link';
import React from 'react';
import { Avatar, Chip } from '@heroui/react';
import { ChevronRightIcon, UserIcon } from 'lucide-react';
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
          key={student.uuid}
          href={`/students/${student.uuid}`}
          className="w-full flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm"
        >
          {/* 아바타 */}
          <Avatar size="lg" className="shrink-0">
            {student.profileImageUrl
              ? <Avatar.Image src={student.profileImageUrl} alt={student.name} loading="lazy" />
              : null}
            <Avatar.Fallback><UserIcon className="w-5 h-5" /></Avatar.Fallback>
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
          </div>

          {/* 화살표 */}
          <ChevronRightIcon className="w-5 h-5 text-zinc-300 flex-shrink-0" />
        </Link>
      ))}
    </div>
  );
}
