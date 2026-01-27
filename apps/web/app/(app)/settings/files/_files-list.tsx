'use client';

import * as React from 'react';
import { Button, Surface, Tooltip, Menu, Popover } from '@heroui/react';
import { Trash2, ImageIcon, Video, FileX, FileTextIcon, MoreVertical, FolderInput } from 'lucide-react';

import type { TMediaFile, TFolder } from '@/types/index';
import FilePreviewModal from './_file-preview-modal';
import DeleteFileModal from './_delete-file-modal';
import FolderItem from './_folder-item';
import EditFolderModal from './_edit-folder-modal';
import DeleteFolderModal from './_delete-folder-modal';
import MoveFileModal from './_move-file-modal';

interface FilesListProps {
  files: TMediaFile[];
  folders: TFolder[];
  sortOrder: 'newest' | 'oldest' | 'largest' | 'smallest';
  searchQuery: string;
  currentFolderUuid?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

function getCloudinaryThumbnail(url: string, type: 'image' | 'video' | 'document'): string | null {
  if (type === 'document') {
    return null; // PDFs don't have thumbnails
  }
  if (type === 'video') {
    return url.replace('/upload/', '/upload/c_fill,w_200,h_200,so_0/').replace(/\.\w+$/, '.jpg');
  }
  return url.replace('/upload/', '/upload/c_fill,w_200,h_200/');
}

export default function FilesList({ files, folders, sortOrder, searchQuery, currentFolderUuid }: FilesListProps) {
  const [previewFile, setPreviewFile] = React.useState<TMediaFile | null>(null);
  const [deleteFile, setDeleteFile] = React.useState<TMediaFile | null>(null);
  const [moveFile, setMoveFile] = React.useState<TMediaFile | null>(null);
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
}

function FileRow({ file, onPreview, onDelete, onMove }: FileRowProps) {
  const thumbnailUrl = getCloudinaryThumbnail(file.url, file.type);
  const fileName = file.fileName || 'Untitled';

  const getTypeIcon = () => {
    switch (file.type) {
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5" />;
      case 'video':
        return <Video className="w-3.5 h-3.5" />;
      case 'document':
        return <FileTextIcon className="w-3.5 h-3.5" />;
    }
  };

  const getTypeLabel = () => {
    switch (file.type) {
      case 'image':
        return '이미지';
      case 'video':
        return '동영상';
      case 'document':
        return 'PDF';
    }
  };

  return (
    <div className="group flex items-center gap-4 p-3 hover:bg-gray-50 transition-colors">
      <button
        type="button"
        className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={onPreview}
      >
        {thumbnailUrl ? (
          <>
            <img
              src={thumbnailUrl}
              alt={fileName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {file.type === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Video className="w-5 h-5 text-white" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileTextIcon className="w-6 h-6 text-gray-400" />
          </div>
        )}
      </button>

      <button
        type="button"
        className="flex-1 min-w-0 text-left cursor-pointer focus:outline-none"
        onClick={onPreview}
      >
        <p className="font-medium truncate" title={fileName}>
          {fileName}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            {getTypeIcon()}
            {getTypeLabel()}
          </span>
          <span>·</span>
          <span>{formatBytes(file.fileSize)}</span>
        </div>
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
