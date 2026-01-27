'use client';

import * as React from 'react';
import { VideoIcon, XIcon, PlusIcon, FileIcon } from 'lucide-react';
import { Button, Surface } from '@heroui/react';
import type { TMediaFile, TLessonMediaFile } from '@/types/index';
import MediaFileAttachModal from './media-file-attach-modal';

export interface MediaFilePickerState {
  existingFiles: TLessonMediaFile[];
  pendingDetach: string[]; // 연결 해제할 media file UUID들
  pendingAddExisting: TMediaFile[]; // 라이브러리에서 새로 선택한 기존 파일들
}

interface Props {
  value: MediaFilePickerState;
  onChange: (state: MediaFilePickerState) => void;
  maxFiles?: number;
  disabled?: boolean;
  variant?: 'thumbnail' | 'simple';
}

export default function MediaFilePicker({
  value,
  onChange,
  maxFiles = 5,
  disabled = false,
  variant = 'thumbnail',
}: Props) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // 표시할 파일들 (삭제 대기 제외)
  const visibleExistingFiles = value.existingFiles.filter(
    (lmf) => !value.pendingDetach.includes(lmf.mediaFile.uuid),
  );
  const pendingAddExistingFiles = value.pendingAddExisting || [];
  const totalFilesCount = visibleExistingFiles.length + pendingAddExistingFiles.length;
  const canAddMore = totalFilesCount < maxFiles;

  const handleRemoveExisting = (uuid: string) => {
    onChange({
      ...value,
      pendingDetach: [...value.pendingDetach, uuid],
    });
  };

  const handleRemovePendingExisting = (uuid: string) => {
    onChange({
      ...value,
      pendingAddExisting: (value.pendingAddExisting || []).filter((f) => f.uuid !== uuid),
    });
  };

  const handleRestoreExisting = (uuid: string) => {
    onChange({
      ...value,
      pendingDetach: value.pendingDetach.filter((u) => u !== uuid),
    });
  };

  // 선택 완료 시 기존 파일 선택 처리
  const handleConfirm = (selectedFiles: TMediaFile[]) => {
    // 이미 첨부된 파일 UUID들
    const alreadyAttachedUuids = value.existingFiles.map((lmf) => lmf.mediaFile.uuid);
    // 이미 추가 대기 중인 파일 UUID들
    const alreadyPendingAddUuids = (value.pendingAddExisting || []).map((f) => f.uuid);

    // 선택된 파일들 중 새로 추가할 기존 파일들 (아직 첨부되지 않은 것들)
    const newlySelectedExistingFiles = selectedFiles
      .filter((f) => !alreadyAttachedUuids.includes(f.uuid) && !alreadyPendingAddUuids.includes(f.uuid));

    // 기존 파일 중 선택된 것들 복원 (detach 취소)
    const restoredUuids = selectedFiles.map((f) => f.uuid);
    const newPendingDetach = value.pendingDetach.filter(
      (uuid) => !restoredUuids.includes(uuid),
    );

    const newState: MediaFilePickerState = {
      ...value,
      pendingDetach: newPendingDetach,
      pendingAddExisting: [...(value.pendingAddExisting || []), ...newlySelectedExistingFiles],
    };

    onChange(newState);
  };

  const renderThumbnail = (
    file: TMediaFile,
    onRemove: () => void,
    isPending = false,
  ) => {
    const isVideo = file.type === 'video';

    return (
      <div className="relative group">
        <Surface
          className={`
            w-20 h-20 rounded-lg overflow-hidden flex items-center justify-center
            ${isPending ? 'ring-2 ring-accent' : ''}
          `}
          variant="secondary"
        >
          {isVideo ? (
            <div className="flex flex-col items-center gap-1">
              <VideoIcon className="size-6 text-default-400" />
              <span className="text-[10px] text-default-400 px-1 truncate max-w-full">
                {file.fileName || 'video'}
              </span>
            </div>
          ) : (
            <img
              src={file.url}
              alt={file.fileName || 'image'}
              className="w-full h-full object-cover"
            />
          )}
        </Surface>
        <Button
          size="sm"
          variant="danger"
          isIconOnly
          className="absolute -top-1 -right-1 size-5 min-w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onPress={onRemove}
        >
          <XIcon className="size-3" />
        </Button>
        {isPending && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] bg-accent text-white px-1 rounded">
            새 파일
          </span>
        )}
      </div>
    );
  };

  const renderSimpleFile = (
    file: TMediaFile,
    onRemove: () => void,
    isPending = false,
  ) => {
    return (
      <div className="flex items-center gap-2 py-1">
        <FileIcon className="size-4 text-default-400 shrink-0" />
        <span className="text-sm truncate grow">{file.fileName || 'file'}</span>
        {isPending && <span className="text-xs text-accent">새 파일</span>}
        <Button size="sm" variant="ghost" isIconOnly onPress={onRemove}>
          <XIcon className="size-4" />
        </Button>
      </div>
    );
  };

  const renderSimpleDetachedFile = (lmf: TLessonMediaFile) => {
    const file = lmf.mediaFile;
    return (
      <div key={file.uuid} className="flex items-center gap-2 py-1 opacity-50">
        <FileIcon className="size-4 text-default-400 shrink-0" />
        <span className="text-sm truncate grow line-through">{file.fileName || 'file'}</span>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => handleRestoreExisting(file.uuid)}
        >
          취소
        </Button>
      </div>
    );
  };

  const renderDetachedFile = (lmf: TLessonMediaFile) => {
    const file = lmf.mediaFile;
    const isVideo = file.type === 'video';

    return (
      <div key={file.uuid} className="relative group opacity-50">
        <Surface
          className="w-20 h-20 rounded-lg overflow-hidden flex items-center justify-center"
          variant="secondary"
        >
          {isVideo ? (
            <div className="flex flex-col items-center gap-1">
              <VideoIcon className="size-6 text-default-400" />
              <span className="text-[10px] text-default-400 px-1 truncate max-w-full">
                {file.fileName || 'video'}
              </span>
            </div>
          ) : (
            <img
              src={file.url}
              alt={file.fileName || 'image'}
              className="w-full h-full object-cover grayscale"
            />
          )}
        </Surface>
        <Button
          size="sm"
          variant="secondary"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs"
          onPress={() => handleRestoreExisting(file.uuid)}
        >
          취소
        </Button>
      </div>
    );
  };

  // 삭제 대기 파일들
  const detachedFiles = value.existingFiles.filter((lmf) =>
    value.pendingDetach.includes(lmf.mediaFile.uuid),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          첨부 파일 ({totalFilesCount}/{maxFiles})
        </span>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={!canAddMore || disabled}
          onPress={() => setIsModalOpen(true)}
        >
          <PlusIcon className="size-4" />
          파일 첨부
        </Button>
      </div>

      {totalFilesCount > 0 || detachedFiles.length > 0 ? (
        variant === 'simple' ? (
          <div className="flex flex-col">
            {/* 기존 파일들 */}
            {visibleExistingFiles.map((lmf) => (
              <React.Fragment key={lmf.mediaFile.uuid}>
                {renderSimpleFile(lmf.mediaFile, () => handleRemoveExisting(lmf.mediaFile.uuid))}
              </React.Fragment>
            ))}

            {/* 라이브러리에서 새로 선택한 기존 파일들 */}
            {pendingAddExistingFiles.map((file) => (
              <React.Fragment key={`add-existing-${file.uuid}`}>
                {renderSimpleFile(file, () => handleRemovePendingExisting(file.uuid), true)}
              </React.Fragment>
            ))}

            {/* 삭제 대기 파일들 */}
            {detachedFiles.map((lmf) => renderSimpleDetachedFile(lmf))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {/* 기존 파일들 */}
            {visibleExistingFiles.map((lmf) =>
              renderThumbnail(lmf.mediaFile, () => handleRemoveExisting(lmf.mediaFile.uuid)),
            )}

            {/* 라이브러리에서 새로 선택한 기존 파일들 */}
            {pendingAddExistingFiles.map((file) => (
              <React.Fragment key={`add-existing-${file.uuid}`}>
                {renderThumbnail(file, () => handleRemovePendingExisting(file.uuid), true)}
              </React.Fragment>
            ))}

            {/* 삭제 대기 파일들 */}
            {detachedFiles.map((lmf) => renderDetachedFile(lmf))}
          </div>
        )
      ) : (
        <Surface
          className="p-4 rounded-xl text-center text-sm text-default-500"
          variant="secondary"
        >
          첨부된 파일이 없습니다
        </Surface>
      )}

      <MediaFileAttachModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        selectedUuids={[
          ...visibleExistingFiles.map((lmf) => lmf.mediaFile.uuid),
          ...pendingAddExistingFiles.map((f) => f.uuid),
        ]}
        onConfirm={handleConfirm}
        maxSelect={maxFiles - totalFilesCount}
      />
    </div>
  );
}
