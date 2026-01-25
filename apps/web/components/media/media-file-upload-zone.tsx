'use client';

import * as React from 'react';
import { UploadCloudIcon, XIcon, FileIcon, ImageIcon, VideoIcon, Loader2Icon } from 'lucide-react';
import { Button, Surface } from '@heroui/react';
import { uploadToS3, validateFile, getResourceType } from '@/utils/s3-upload';
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
}

export default function MediaFileUploadZone({ onUploadComplete, disabled, remainingBytes }: Props) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [uploadingFiles, setUploadingFiles] = React.useState<UploadingFile[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      // 유효성 검사
      const validation = validateFile(file);
      if (!validation.valid) {
        setUploadingFiles((prev) => [
          ...prev,
          { id: crypto.randomUUID(), file, progress: 0, error: validation.error },
        ]);
        continue;
      }

      // 용량 확인
      if (remainingBytes !== undefined && file.size > remainingBytes) {
        setUploadingFiles((prev) => [
          ...prev,
          { id: crypto.randomUUID(), file, progress: 0, error: '스토리지 용량이 부족합니다.' },
        ]);
        continue;
      }

      const uploadId = crypto.randomUUID();
      setUploadingFiles((prev) => [...prev, { id: uploadId, file, progress: 0 }]);

      // 업로드 시작
      const result = await uploadToS3(file);

      if (result.success) {
        onUploadComplete({
          url: result.url,
          publicId: result.key,
          type: result.resourceType,
          fileName: file.name,
          fileSize: result.fileSize,
        });
        setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId));
      }
      else {
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === uploadId ? { ...f, error: result.error } : f)),
        );
      }
    }
  };

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
          이미지 (10MB) / 동영상 (100MB)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
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
                    <Loader2Icon className="size-3 animate-spin text-accent" />
                    <span className="text-xs text-default-400">업로드 중...</span>
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
