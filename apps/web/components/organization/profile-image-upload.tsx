'use client';

import * as React from 'react';
import { Spinner } from '@heroui/react';
import { CameraIcon, XIcon, UserIcon } from 'lucide-react';

const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  onPublicIdChange?: (publicId: string | null) => void;
  disabled?: boolean;
  currentImageUrl?: string | null;
}

export default function ProfileImageUpload({ value, onChange, onPublicIdChange, disabled, currentImageUrl }: Props) {
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
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/organizations/profile-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '업로드에 실패했습니다.');
      }
      else {
        onChange(data.url);
        onPublicIdChange?.(data.publicId);
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
    onPublicIdChange?.(null);
  };

  const displayImageUrl = value || currentImageUrl;
  const hasImage = !!displayImageUrl;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">프로필 이미지</label>
      <div className="flex items-center gap-4">
        <div
          className="relative cursor-pointer group"
          onClick={handleClick}
        >
          {hasImage ? (
            <div className="relative">
              <img
                src={displayImageUrl}
                alt="프로필 이미지"
                className="size-20 rounded-full object-cover"
              />
              {isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <Spinner size="sm" color="white" />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <CameraIcon className="size-6 text-white" />
                </div>
              )}
              {!isUploading && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="absolute -top-1 -right-1 size-6 rounded-full bg-danger-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger-600"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <div className="size-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                <UserIcon className="size-8 text-gray-400" />
              </div>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
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
