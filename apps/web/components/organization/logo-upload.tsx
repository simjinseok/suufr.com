'use client';

import * as React from 'react';
import { Spinner } from '@heroui/react';
import { CameraIcon, XIcon } from 'lucide-react';
import { uploadToCloudinary } from '@/utils/cloudinary-upload';

const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  /** 기존에 저장된 이미지 URL (서버에서 생성된 전체 URL) */
  currentImageUrl?: string | null;
}

export default function OrganizationLogoUpload({ value, onChange, disabled, currentImageUrl }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (file.size > MAX_FILE_SIZE) {
      setError('파일 크기는 1MB 이하여야 합니다.');
      return;
    }

    if (!ALLOWED_FORMATS.includes(file.type)) {
      setError('JPG, PNG, WebP 형식만 지원합니다.');
      return;
    }

    setIsUploading(true);

    try {
      // Cloudinary로 직접 업로드
      const result = await uploadToCloudinary(file);

      if (!result.success) {
        setError(result.error);
      }
      else {
        onChange(result.url);
      }
    }
    catch {
      setError('업로드 중 오류가 발생했습니다.');
    }
    finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      inputRef.current?.click();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  // 새로 업로드된 이미지가 있으면 그것을, 없으면 기존 저장된 이미지 URL 사용
  const displayImageUrl = value || currentImageUrl;
  const hasImage = !!displayImageUrl;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">로고</label>
      <div className="flex items-center gap-4">
        <div
          className="relative cursor-pointer group"
          onClick={handleClick}
        >
          {hasImage ? (
            <div className="relative">
              <img
                src={displayImageUrl}
                alt="조직 로고"
                className="h-[120px]"
              />
              {isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Spinner size="sm" color="white" />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CameraIcon className="size-6 text-white" />
                </div>
              )}
              {!isUploading && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="absolute -top-2 -right-2 size-6 rounded-full bg-danger-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger-600"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <div className="size-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                <CameraIcon className="size-5 text-gray-400" />
              </div>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <Spinner size="sm" color="white" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500">
          <p>최대 1MB (JPG, PNG, WebP)</p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-danger-500">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_FORMATS.join(',')}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />
    </div>
  );
}
