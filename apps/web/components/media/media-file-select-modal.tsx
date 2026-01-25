'use client';

import * as React from 'react';
import { CheckIcon, ImageIcon, VideoIcon, Loader2Icon } from 'lucide-react';
import { Button, Modal, Surface, ModalProps } from '@heroui/react';
import type { TMediaFile, TTempMediaFile, TStorageQuota } from '@/types/index';
import { getStorageQuota, getMyMediaFiles } from '@/actions/storage';
import MediaFileUploadZone from './media-file-upload-zone';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  selectedUuids: string[];
  onConfirm: (selectedFiles: TMediaFile[], uploadedFiles: TTempMediaFile[]) => void;
  maxSelect?: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function MediaFileSelectModal({
  isOpen,
  onOpenChange,
  selectedUuids,
  onConfirm,
  maxSelect = 5,
}: Props) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [quota, setQuota] = React.useState<TStorageQuota | null>(null);
  const [files, setFiles] = React.useState<TMediaFile[]>([]);
  const [localSelected, setLocalSelected] = React.useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = React.useState(false);
  const [pendingUploads, setPendingUploads] = React.useState<TTempMediaFile[]>([]);

  // 모달 열릴 때 데이터 로드
  React.useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setLocalSelected(new Set(selectedUuids));
      setPendingUploads([]);

      Promise.all([getStorageQuota(), getMyMediaFiles()])
        .then(([quotaData, filesData]) => {
          setQuota(quotaData);
          setFiles(filesData);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, selectedUuids]);

  const handleToggleFile = (uuid: string) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
      }
      else if (next.size < maxSelect) {
        next.add(uuid);
      }
      return next;
    });
  };

  const handleUploadComplete = (file: TTempMediaFile) => {
    setPendingUploads((prev) => [...prev, file]);
    // 용량 업데이트 (로컬)
    if (quota) {
      setQuota({
        ...quota,
        usedBytes: quota.usedBytes + file.fileSize,
        remainingBytes: Math.max(0, quota.remainingBytes - file.fileSize),
      });
    }
  };

  const handleConfirm = () => {
    // 선택된 기존 파일들
    const selectedFiles = files.filter((f) => localSelected.has(f.uuid));
    // 한 번에 전달
    onConfirm(selectedFiles, pendingUploads);
  };

  const usagePercent = quota ? (quota.usedBytes / quota.quotaBytes) * 100 : 0;
  const isOverQuota = usagePercent >= 100;
  const isNearQuota = usagePercent >= 80;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog size="lg">
          {({ close }) => (
            <>
              <Modal.Header>
                <Modal.Heading>파일 선택</Modal.Heading>
              </Modal.Header>

              <Modal.Body>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2Icon className="size-6 animate-spin text-default-400" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* 용량 상태 */}
                    {quota && (
                      <Surface className="p-3 rounded-xl" variant="secondary">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">스토리지 용량</span>
                          <span
                            className={`text-sm ${isNearQuota ? 'text-warning' : 'text-default-500'}`}
                          >
                            {formatBytes(quota.usedBytes)} / {formatBytes(quota.quotaBytes)}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-default-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              isOverQuota ? 'bg-danger' : isNearQuota ? 'bg-warning' : 'bg-accent'
                            }`}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          />
                        </div>
                        {isOverQuota && (
                          <p className="text-xs text-danger mt-2">
                            용량이 초과되어 새 파일을 업로드할 수 없습니다.
                          </p>
                        )}
                      </Surface>
                    )}

                    {/* 업로드 토글 버튼 */}
                    <Button
                      variant="secondary"
                      onPress={() => setShowUpload(!showUpload)}
                      isDisabled={isOverQuota}
                    >
                      {showUpload ? '파일 목록 보기' : '새 파일 업로드'}
                    </Button>

                    {/* 업로드 영역 */}
                    {showUpload && (
                      <MediaFileUploadZone
                        onUploadComplete={handleUploadComplete}
                        disabled={isOverQuota}
                        remainingBytes={quota?.remainingBytes}
                      />
                    )}

                    {/* 새로 업로드된 파일 목록 */}
                    {pendingUploads.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-accent">
                          새로 업로드됨 ({pendingUploads.length})
                        </span>
                        <div className="grid grid-cols-4 gap-2">
                          {pendingUploads.map((file, index) => (
                            <Surface
                              key={`pending-${index}`}
                              className="aspect-square rounded-lg overflow-hidden flex items-center justify-center ring-2 ring-accent"
                              variant="secondary"
                            >
                              {file.type === 'video' ? (
                                <VideoIcon className="size-8 text-default-400" />
                              ) : (
                                <img
                                  src={file.url}
                                  alt={file.fileName}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </Surface>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 파일 목록 */}
                    {!showUpload && (
                      <>
                        {files.length === 0 ? (
                          <Surface
                            className="p-8 rounded-xl text-center text-sm text-default-500"
                            variant="secondary"
                          >
                            업로드된 파일이 없습니다.
                            <br />
                            "새 파일 업로드" 버튼을 눌러 파일을 추가하세요.
                          </Surface>
                        ) : (
                          <div className="grid grid-cols-4 gap-2 max-h-80 overflow-y-auto">
                            {files.map((file) => {
                              const isSelected = localSelected.has(file.uuid);
                              const isAlreadyAttached = selectedUuids.includes(file.uuid);

                              return (
                                <button
                                  key={file.uuid}
                                  type="button"
                                  onClick={() => handleToggleFile(file.uuid)}
                                  className={`
                                    relative aspect-square rounded-lg overflow-hidden
                                    transition-all cursor-pointer
                                    ${isSelected ? 'ring-2 ring-accent' : 'hover:ring-2 hover:ring-default-300'}
                                    ${isAlreadyAttached ? 'opacity-50' : ''}
                                  `}
                                >
                                  <Surface
                                    className="w-full h-full flex items-center justify-center"
                                    variant="secondary"
                                  >
                                    {file.type === 'video' ? (
                                      <VideoIcon className="size-8 text-default-400" />
                                    ) : (
                                      <img
                                        src={file.url}
                                        alt={file.fileName || 'image'}
                                        className="w-full h-full object-cover"
                                      />
                                    )}
                                  </Surface>
                                  {isSelected && (
                                    <div className="absolute top-1 right-1 size-5 bg-accent text-white rounded-full flex items-center justify-center">
                                      <CheckIcon className="size-3" />
                                    </div>
                                  )}
                                  {isAlreadyAttached && !isSelected && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                      <span className="text-xs text-white">첨부됨</span>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Modal.Body>

              <Modal.Footer>
                <Button variant="ghost" onPress={close}>
                  취소
                </Button>
                <Button
                  variant="primary"
                  onPress={() => {
                    handleConfirm();
                    close();
                  }}
                  isDisabled={localSelected.size === 0 && pendingUploads.length === 0}
                >
                  {pendingUploads.length > 0
                    ? `선택 완료 (${localSelected.size + pendingUploads.length})`
                    : `선택 완료 (${localSelected.size})`}
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
