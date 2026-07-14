'use client';

import * as React from 'react';
import { UploadCloudIcon, XIcon, FileIcon, ImageIcon, VideoIcon, FileTextIcon } from 'lucide-react';
import { Button, Surface } from '@heroui/react';
import { uploadToS3, validateFile, getResourceType } from '@/utils/s3-upload';
import { UPLOAD_ACCEPT_ATTR } from '@/utils/file-constraints';
import type { TTempMediaFile } from '@/types/index';

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  error?: string;
}

interface Props {
  onUploadComplete: (file: TTempMediaFile) => void;
  disabled?: boolean;
  remainingBytes?: number;
  /** 마운트 시 바로 업로드를 시작할 파일 (페이지 드래그앤드롭 → 모달 오픈 경로) */
  initialFiles?: File[];
}

/** 동시 업로드 개수 상한 */
const UPLOAD_CONCURRENCY = 3;

export default function MediaFileUploadZone({ onUploadComplete, disabled, remainingBytes, initialFiles }: Props) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [uploadingFiles, setUploadingFiles] = React.useState<UploadingFile[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    // 검증 + 큐 구성. 잔여 용량은 이번에 선택한 파일들의 누적 합으로 판정
    let budget = remainingBytes;
    const queue: UploadingFile[] = [];
    const rejected: UploadingFile[] = [];

    for (const file of fileArray) {
      const validation = validateFile(file);
      if (!validation.valid) {
        rejected.push({ id: crypto.randomUUID(), file, progress: 0, error: validation.error });
        continue;
      }

      if (budget !== undefined && file.size > budget) {
        rejected.push({ id: crypto.randomUUID(), file, progress: 0, error: '스토리지 용량이 부족합니다.' });
        continue;
      }
      if (budget !== undefined) {
        budget -= file.size;
      }

      queue.push({ id: crypto.randomUUID(), file, progress: 0 });
    }

    setUploadingFiles((prev) => [...prev, ...queue, ...rejected]);

    // 워커 풀: 최대 UPLOAD_CONCURRENCY개 파일을 동시에 업로드
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        const result = await uploadToS3(item.file, {
          onProgress: (percentage) => {
            setUploadingFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, progress: percentage } : f)),
            );
          },
        });

        if (result.success) {
          onUploadComplete({
            url: result.url,
            publicId: result.key,
            type: result.resourceType,
            contentType: item.file.type,
            fileName: item.file.name,
            fileSize: result.fileSize,
          });
          setUploadingFiles((prev) => prev.filter((f) => f.id !== item.id));
        }
        else {
          setUploadingFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, error: result.error } : f)),
          );
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, () => worker()),
    );
  };

  // initialFiles는 마운트 시 1회만 처리
  const initialFilesProcessed = React.useRef(false);
  React.useEffect(() => {
    if (!initialFilesProcessed.current && initialFiles && initialFiles.length > 0 && !disabled) {
      initialFilesProcessed.current = true;
      handleFiles(initialFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeUploadingFile = (id: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const getFileIcon = (file: File) => {
    const type = getResourceType(file);
    if (type === 'image') return <ImageIcon className="size-4" />;
    if (type === 'video') return <VideoIcon className="size-4" />;
    if (type === 'document') return <FileTextIcon className="size-4" />;
    return <FileIcon className="size-4" />;
  };

  return (
    <div className="flex flex-col gap-3">
      <Surface
        className={`
          p-6 rounded-xl border-2 border-dashed transition-colors cursor-pointer
          flex flex-col items-center justify-center gap-2
          ${isDragging ? 'border-accent bg-accent-soft' : 'border-default-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <UploadCloudIcon className="size-8 text-default-400" />
        <p className="text-sm text-default-600">
          파일을 드래그하거나 클릭하여 업로드
        </p>
        <p className="text-xs text-default-400">
          이미지 (10MB) / 동영상 (100MB) / PDF (50MB)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={UPLOAD_ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled}
        />
      </Surface>

      {uploadingFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          {uploadingFiles.map((item) => (
            <Surface
              key={item.id}
              className="p-3 rounded-lg flex items-center gap-3"
              variant="secondary"
            >
              {getFileIcon(item.file)}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{item.file.name}</p>
                {item.error ? (
                  <p className="text-xs text-danger">{item.error}</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 bg-default-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-default-400 tabular-nums w-9 text-right">
                      {item.progress}%
                    </span>
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={() => removeUploadingFile(item.id)}
              >
                <XIcon className="size-4" />
              </Button>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}
