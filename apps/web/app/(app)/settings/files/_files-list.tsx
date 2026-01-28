'use client';

import * as React from 'react';
import { Button, Surface, Menu, Popover } from '@heroui/react';
import { Trash2, ImageIcon, Video, FileX, FileTextIcon, MoreVertical, FolderInput, Pencil } from 'lucide-react';

import type { TMediaFile, TFolder } from '@/types/index';
import FilePreviewModal from './_file-preview-modal';
import DeleteFileModal from './_delete-file-modal';
import FolderItem from './_folder-item';
import EditFolderModal from './_edit-folder-modal';
import DeleteFolderModal from './_delete-folder-modal';
import MoveFileModal from './_move-file-modal';
import RenameFileModal from './_rename-file-modal';

interface FilesListProps {
  files: TMediaFile[];
  folders: TFolder[];
  sortOrder: 'newest' | 'oldest' | 'largest' | 'smallest';
  searchQuery: string;
  currentFolderUuid?: string;
}

export default function FilesList({ files, folders, sortOrder, searchQuery, currentFolderUuid }: FilesListProps) {
  const [previewFile, setPreviewFile] = React.useState<TMediaFile | null>(null);
  const [deleteFile, setDeleteFile] = React.useState<TMediaFile | null>(null);
  const [moveFile, setMoveFile] = React.useState<TMediaFile | null>(null);
  const [renameFile, setRenameFile] = React.useState<TMediaFile | null>(null);
  const [editFolder, setEditFolder] = React.useState<TFolder | null>(null);
  const [deleteFolder, setDeleteFolder] = React.useState<TFolder | null>(null);

  // 현재 폴더에 있는 하위 폴더들 필터링
  const currentFolders = React.useMemo(() => {
    if (searchQuery) return []; // 검색 중에는 폴더 표시 안함

    // 플랫 구조에서 현재 폴더의 직접 하위만 필터
    const flattenAll = (items: TFolder[]): TFolder[] => {
      const result: TFolder[] = [];
      for (const folder of items) {
        result.push(folder);
        if (folder.children && folder.children.length > 0) {
          result.push(...flattenAll(folder.children));
        }
      }
      return result;
    };

    const allFolders = flattenAll(folders);

    if (!currentFolderUuid) {
      // 루트에서는 parentId가 null인 폴더들
      return folders;
    }

    // 현재 폴더의 직접 자식들
    const currentFolder = allFolders.find(f => f.uuid === currentFolderUuid);
    return currentFolder?.children || [];
  }, [folders, currentFolderUuid, searchQuery]);

  const filteredAndSortedFiles = React.useMemo(() => {
    let result = [...files];

    // 정렬
    result.sort((a, b) => {
      switch (sortOrder) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'largest':
          return b.fileSize - a.fileSize;
        case 'smallest':
          return a.fileSize - b.fileSize;
        default:
          return 0;
      }
    });

    return result;
  }, [files, sortOrder]);

  const isEmpty = currentFolders.length === 0 && filteredAndSortedFiles.length === 0;

  if (isEmpty) {
    const emptyMessage = searchQuery
      ? `"${searchQuery}"에 대한 검색 결과가 없습니다.`
      : currentFolderUuid
        ? '이 폴더는 비어 있습니다.'
        : '업로드된 파일이 없습니다.';

    return (
      <Surface className="p-10 border border-gray-50 rounded-xl shadow-xs">
        <div className="flex flex-col items-center justify-center text-center">
          <FileX className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      </Surface>
    );
  }

  return (
    <>
      <Surface className="border border-gray-50 rounded-xl shadow-xs divide-y divide-gray-100">
        {/* 폴더 목록 */}
        {currentFolders.map((folder) => (
          <FolderItem
            key={folder.uuid}
            folder={folder}
            onEdit={setEditFolder}
            onDelete={setDeleteFolder}
          />
        ))}

        {/* 파일 목록 */}
        {filteredAndSortedFiles.map((file) => (
          <FileRow
            key={file.uuid}
            file={file}
            onPreview={() => setPreviewFile(file)}
            onDelete={() => setDeleteFile(file)}
            onMove={() => setMoveFile(file)}
            onRename={() => setRenameFile(file)}
          />
        ))}
      </Surface>

      <FilePreviewModal
        isOpen={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        file={previewFile}
      />

      <DeleteFileModal
        isOpen={!!deleteFile}
        onOpenChange={(open) => !open && setDeleteFile(null)}
        file={deleteFile}
      />

      <MoveFileModal
        isOpen={!!moveFile}
        onOpenChange={(open) => !open && setMoveFile(null)}
        file={moveFile}
      />

      <RenameFileModal
        isOpen={!!renameFile}
        onOpenChange={(open) => !open && setRenameFile(null)}
        file={renameFile}
      />

      <EditFolderModal
        isOpen={!!editFolder}
        onOpenChange={(open) => !open && setEditFolder(null)}
        folder={editFolder}
      />

      <DeleteFolderModal
        isOpen={!!deleteFolder}
        onOpenChange={(open) => !open && setDeleteFolder(null)}
        folder={deleteFolder}
      />
    </>
  );
}

interface FileRowProps {
  file: TMediaFile;
  onPreview: () => void;
  onDelete: () => void;
  onMove: () => void;
  onRename: () => void;
}

function FileRow({ file, onPreview, onDelete, onMove, onRename }: FileRowProps) {
  const fileName = file.fileName || 'Untitled';

  const getTypeIcon = () => {
    switch (file.type) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-blue-500" />;
      case 'video':
        return <Video className="w-5 h-5 text-purple-500" />;
      case 'document':
        return <FileTextIcon className="w-5 h-5 text-amber-500" />;
    }
  };

  const getIconBgColor = () => {
    switch (file.type) {
      case 'image':
        return 'bg-blue-50';
      case 'video':
        return 'bg-purple-50';
      case 'document':
        return 'bg-amber-50';
    }
  };

  return (
    <div className="group flex items-center gap-4 p-2 hover:bg-gray-50 transition-colors">
      <button
        type="button"
        className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${getIconBgColor()}`}
        onClick={onPreview}
      >
        {getTypeIcon()}
      </button>

      <button
        type="button"
        className="flex-1 min-w-0 text-left cursor-pointer focus:outline-none"
        onClick={onPreview}
      >
        <p className="font-medium truncate" title={fileName}>
          {fileName}
        </p>
      </button>

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
              <Menu.Item onAction={onRename}>
                <Pencil className="w-4 h-4" />
                이름 변경
              </Menu.Item>
              <Menu.Item onAction={onMove}>
                <FolderInput className="w-4 h-4" />
                이동
              </Menu.Item>
              {file.isInUse ? (
                <Menu.Item isDisabled>
                  <Trash2 className="w-4 h-4" />
                  삭제 (사용 중)
                </Menu.Item>
              ) : (
                <Menu.Item onAction={onDelete} className="text-danger">
                  <Trash2 className="w-4 h-4" />
                  삭제
                </Menu.Item>
              )}
            </Menu>
          </Popover.Content>
        </Popover>
      </div>
    </div>
  );
}
