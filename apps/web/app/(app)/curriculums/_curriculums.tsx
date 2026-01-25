'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@heroui/react';
import { BookOpenIcon, ChevronRightIcon } from 'lucide-react';
import type { TCurriculum } from '@/types/index';

export default function Curriculums({ curriculums }: { curriculums: TCurriculum[] }) {
  if (curriculums.length === 0) {
    return (
      <div className="mt-5 py-12 text-center text-zinc-500">
        커리큘럼이 없어요
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-2">
      {curriculums.map(curriculum => (
        <Link
          key={curriculum.uuid}
          href={`/curriculums/${curriculum.uuid}`}
          className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-xs"
        >
          <BookOpenIcon className="size-7 text-accent shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold truncate">{curriculum.title}</span>
              <span className="text-sm text-zinc-400">{curriculum.items.length}개 항목</span>
            </div>
            {curriculum.description && (
              <div className="text-sm text-zinc-500 truncate">
                {curriculum.description}
              </div>
            )}
          </div>

          <Button size="sm" variant="ghost" isIconOnly>
            <ChevronRightIcon className="size-4" />
          </Button>
        </Link>
      ))}
    </div>
  );
}
