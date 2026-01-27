'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Select, ListBox, TextField, InputGroup, toast } from '@heroui/react';
import { Upload, Search, X, Loader2, FolderPlus } from 'lucide-react';

import type { TStorageQuota } from '@/types/index';
import { uploadToS3, validateFile } from '@/utils/s3-upload';
import { createMediaFile } from '@/actions/storage';
import CreateFolderModal from './_create-folder-modal';

interface NewFolderButtonProps {
  parentFolderUuid?: string;
}

export function NewFolderButton({ parentFolderUuid }: NewFolderButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button variant="secondary" onPress={() => setIsOpen(true)}>
        <FolderPlus className="w-4 h-4 mr-1" />
        새 폴더
      </Button>
      <CreateFolderModal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        parentFolderUuid={parentFolderUuid}
      />
    </>
  );
}

interface UploadButtonProps {
  quota: TStorageQuota | null;
  currentFolderUuid?: string;
}

export function UploadButton({ quota, currentFolderUuid }: UploadButtonProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const remainingBytes = quota ? quota.quotaBytes - quota.usedBytes : undefined;
  const isOverQuota = quota ? (quota.usedBytes / quota.quotaBytes) >= 1 : false;

  const handleFiles = async (files: FileList) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const file of fileArray) {
      // 유효성 검사
      const validation = validateFile(file);
      if (!validation.valid) {
        toast.danger('업로드 실패', {
          description: validation.error || '유효하지 않은 파일입니다.',
          timeout: 3000,
        });
        errorCount++;
        continue;
      }

      // 용량 확인
      if (remainingBytes !== undefined && file.size > remainingBytes) {
        toast.danger('업로드 실패', {
          description: '스토리지 용량이 부족합니다.',
        });
        errorCount++;
        continue;
      }

      // S3에 업로드
      const result = await uploadToS3(file);

      if (!result.success) {
        toast.danger('업로드 실패', {
          description: result.error || '업로드에 실패했습니다.',
        });
        errorCount++;
        continue;
      }

      // DB에 저장 (현재 폴더에)
      const saveResult = await createMediaFile({
        url: result.url,
        publicId: result.key,
        type: result.resourceType,
        contentType: file.type,
        fileName: file.name,
        fileSize: result.fileSize,
        folderUuid: currentFolderUuid,
      });

      if (saveResult.success) {
        successCount++;
      }
      else {
        toast.danger('파일 저장 실패', {
          description: saveResult.message || '파일을 저장할 수 없습니다.',
        });
        errorCount++;
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success('파일 업로드 완료', {
        description: `${successCount}개의 파일이 업로드되었습니다.`,
        timeout: 3000,
      });
      router.refresh();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <>
      <Button
        variant="primary"
        onPress={() => fileInputRef.current?.click()}
        isDisabled={isOverQuota || isUploading}
      >
        {isUploading
          ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            )
          : (
              <Upload className="w-4 h-4 mr-1" />
            )}
        {isUploading ? '업로드 중...' : '업로드'}
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </>
  );
}

interface FilterBarProps {
  sortOrder: 'newest' | 'oldest' | 'largest' | 'smallest';
  searchQuery: string;
  currentFolderUuid?: string;
}

const sortOptions = [
  { id: 'newest', label: '최신순' },
  { id: 'oldest', label: '오래된순' },
  { id: 'largest', label: '크기순 (큰순)' },
  { id: 'smallest', label: '크기순 (작은순)' },
];

export default function FilterBar({ sortOrder, searchQuery, currentFolderUuid }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localSearch, setLocalSearch] = React.useState(searchQuery);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === '' || (key === 'sort' && value === 'newest')) {
      params.delete(key);
    }
    else {
      params.set(key, value);
    }
    // 폴더 유지
    if (currentFolderUuid && key !== 'folder') {
      params.set('folder', currentFolderUuid);
    }
    router.push(`/settings/files?${params.toString()}`);
  };

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      updateParams('q', value);
    }, 300);
  };

  const clearSearch = () => {
    setLocalSearch('');
    updateParams('q', '');
  };

  return (
    <div className="flex items-center gap-2">
      <TextField
        aria-label="파일 검색"
        value={localSearch}
        onChange={handleSearchChange}
        className="flex-1"
      >
        <InputGroup>
          <InputGroup.Prefix>
            <Search className="w-4 h-4 text-gray-400" />
          </InputGroup.Prefix>
          <InputGroup.Input placeholder="파일명으로 검색..." />
          {localSearch && (
            <InputGroup.Suffix>
              <button
                type="button"
                onClick={clearSearch}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </InputGroup.Suffix>
          )}
        </InputGroup>
      </TextField>

      <Select
        variant="secondary"
        aria-label="정렬 순서"
        selectedKey={sortOrder}
        onSelectionChange={(key) => updateParams('sort', key as string)}
        className="w-28 shrink-0"
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {sortOptions.map((option) => (
              <ListBox.Item key={option.id} id={option.id}>
                {option.label}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
