'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Menu, Popover } from '@heroui/react';
import { Folder, MoreVertical, Pencil, Trash2 } from 'lucide-react';

import type { TFolder } from '@/types/index';
import { updateFolderAction, type UpdateFolderState } from '@/actions/storage';
import InlineEditInput from './_inline-edit-input';

interface FolderItemProps {
  folder: TFolder;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditSuccess: () => void;
  onDelete: (folder: TFolder) => void;
}

export default function FolderItem({ folder, isEditing, onStartEdit, onCancelEdit, onEditSuccess, onDelete }: FolderItemProps) {
  const fileCount = folder._count?.mediaFiles || 0;

  const [state, formAction, isPending] = React.useActionState(updateFolderAction, {
    fields: { uuid: folder.uuid, name: folder.name },
  } as UpdateFolderState);

  React.useEffect(() => {
    if (state.success) {
      onEditSuccess();
    }
  }, [state.success, onEditSuccess]);

  return (
    <div className="group flex items-center gap-4 p-3 hover:bg-gray-50 transition-colors">
      <Link
        href={`/settings/files?folder=${folder.uuid}`}
        className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-accent-soft flex items-center justify-center"
      >
        <Folder className="w-7 h-7 text-accent" />
      </Link>

      {isEditing ? (
        <div className="flex-1 min-w-0">
          <InlineEditInput
            initialValue={folder.name}
            onSave={formAction}
            onCancel={onCancelEdit}
            isPending={isPending}
            errors={state.errors}
            fieldName="name"
            placeholder="폴더 이름을 입력하세요"
            maxLength={50}
            hiddenFields={{ uuid: folder.uuid }}
          />
        </div>
      ) : (
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
      )}

      <div className="shrink-0">
        <Popover>
          <Popover.Trigger>
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              className=""
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </Popover.Trigger>
          <Popover.Content placement="bottom end">
            <Menu>
              <Menu.Item onAction={onStartEdit}>
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
