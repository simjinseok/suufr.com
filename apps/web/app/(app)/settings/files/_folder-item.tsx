'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Menu, Popover, Tooltip } from '@heroui/react';
import { Folder, MoreVertical, Pencil, Trash2 } from 'lucide-react';

import type { TFolder } from '@/types/index';

interface FolderItemProps {
  folder: TFolder;
  onEdit: (folder: TFolder) => void;
  onDelete: (folder: TFolder) => void;
}

export default function FolderItem({ folder, onEdit, onDelete }: FolderItemProps) {
  const fileCount = folder._count?.mediaFiles || 0;

  return (
    <div className="group flex items-center gap-4 p-3 hover:bg-gray-50 transition-colors">
      <Link
        href={`/settings/files?folder=${folder.uuid}`}
        className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-accent-soft flex items-center justify-center"
      >
        <Folder className="w-7 h-7 text-accent" />
      </Link>

      <Link
        href={`/settings/files?folder=${folder.uuid}`}
        className="flex-1 min-w-0 text-left"
      >
        <p className="font-medium truncate" title={folder.name}>
          {folder.name}
        </p>
        <p className="text-sm text-gray-500">
          {fileCount > 0 ? `파일 ${fileCount}개` : '빈 폴더'}
        </p>
      </Link>

      <div className="shrink-0">
        <Popover>
          <Popover.Trigger>
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </Popover.Trigger>
          <Popover.Content placement="bottom end">
            <Menu>
              <Menu.Item onAction={() => onEdit(folder)}>
                <Pencil className="w-4 h-4" />
                이름 변경
              </Menu.Item>
              <Menu.Item onAction={() => onDelete(folder)} className="text-danger">
                <Trash2 className="w-4 h-4" />
                삭제
              </Menu.Item>
            </Menu>
          </Popover.Content>
        </Popover>
      </div>
    </div>
  );
}
