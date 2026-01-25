'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, ModalProps, Surface, toast } from '@heroui/react';
import { CheckCircle } from 'lucide-react';

import MediaFileUploadZone from '@/components/media/media-file-upload-zone';
import { createMediaFile } from '@/actions/storage';
import type { TStorageQuota, TTempMediaFile, TMediaFile } from '@/types/index';

interface UploadFileModalProps {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  quota: TStorageQuota | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

export default function UploadFileModal({ isOpen, onOpenChange, quota }: UploadFileModalProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="max-w-lg">
        <Modal.Dialog>
          {({ close }) => (
            <Content quota={quota} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  quota: TStorageQuota | null;
  close: () => void;
}

function Content({ quota, close }: ContentProps) {
  const router = useRouter();
  const [localQuota, setLocalQuota] = React.useState<TStorageQuota | null>(quota);
  const [uploadedFiles, setUploadedFiles] = React.useState<TMediaFile[]>([]);

  const usagePercent = localQuota ? (localQuota.usedBytes / localQuota.quotaBytes) * 100 : 0;
  const isOverQuota = usagePercent >= 100;
  const isNearQuota = usagePercent >= 80;

  const handleUploadComplete = async (file: TTempMediaFile) => {
    // Cloudinary 업로드 완료 후 DB에 저장
    const result = await createMediaFile({
      url: file.url,
      publicId: file.publicId,
      type: file.type,
      fileName: file.fileName,
      fileSize: file.fileSize,
    });

    if (result.success && result.data) {
      setUploadedFiles((prev) => [...prev, result.data!]);

      // 용량 업데이트 (로컬)
      if (localQuota) {
        setLocalQuota({
          ...localQuota,
          usedBytes: localQuota.usedBytes + file.fileSize,
          remainingBytes: Math.max(0, localQuota.remainingBytes - file.fileSize),
        });
      }
    }
    else {
      toast.danger('파일 저장 실패', {
        description: result.message || '파일을 저장할 수 없습니다.',
      });
    }
  };

  const handleDone = () => {
    if (uploadedFiles.length > 0) {
      toast.success('파일 업로드 완료', {
        description: `${uploadedFiles.length}개의 파일이 업로드되었습니다.`,
      });
      router.refresh();
    }
    close();
  };

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>파일 업로드</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <div className="flex flex-col gap-4">
          {/* 용량 상태 */}
          {localQuota && (
            <Surface className="p-3 rounded-xl" variant="secondary">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">스토리지 용량</span>
                <span
                  className={`text-sm ${isNearQuota ? 'text-warning' : 'text-default-500'}`}
                >
                  {formatBytes(localQuota.usedBytes)} / {formatBytes(localQuota.quotaBytes)}
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

          {/* 업로드 영역 */}
          <MediaFileUploadZone
            onUploadComplete={handleUploadComplete}
            disabled={isOverQuota}
            remainingBytes={localQuota?.remainingBytes}
          />

          {/* 업로드 완료된 파일 목록 */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-accent">
                업로드 완료 ({uploadedFiles.length})
              </span>
              <div className="grid grid-cols-4 gap-2">
                {uploadedFiles.map((file) => (
                  <Surface
                    key={file.uuid}
                    className="relative aspect-square rounded-lg overflow-hidden flex items-center justify-center ring-2 ring-accent"
                    variant="secondary"
                  >
                    {file.type === 'video'
                      ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-default-400 px-1 truncate max-w-full">
                              {file.fileName || 'video'}
                            </span>
                          </div>
                        )
                      : (
                          <img
                            src={file.url}
                            alt={file.fileName || 'image'}
                            className="w-full h-full object-cover"
                          />
                        )}
                    <div className="absolute top-1 right-1 size-5 bg-accent text-white rounded-full flex items-center justify-center">
                      <CheckCircle className="size-3" />
                    </div>
                  </Surface>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={close}>
          취소
        </Button>
        <Button variant="primary" onPress={handleDone}>
          {uploadedFiles.length > 0 ? `완료 (${uploadedFiles.length}개 업로드됨)` : '완료'}
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
