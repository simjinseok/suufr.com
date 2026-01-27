'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

import type { TFolderBreadcrumb } from '@/types/index';

interface FolderBreadcrumbProps {
  breadcrumb: TFolderBreadcrumb[];
}

export default function FolderBreadcrumb({ breadcrumb }: FolderBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 overflow-x-auto pb-1">
      <Link
        href="/settings/files"
        className="flex items-center gap-1 hover:text-gray-900 shrink-0"
      >
        <Home className="w-4 h-4" />
        <span>전체 파일</span>
      </Link>

      {breadcrumb.map((folder) => (
        <React.Fragment key={folder.uuid}>
          <ChevronRight className="w-4 h-4 shrink-0 text-gray-300" />
          <Link
            href={`/settings/files?folder=${folder.uuid}`}
            className="hover:text-gray-900 truncate max-w-[150px]"
            title={folder.name}
          >
            {folder.name}
          </Link>
        </React.Fragment>
      ))}
    </nav>
  );
}
