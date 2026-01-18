'use client';

import * as React from 'react';
import { Spinner } from '@heroui/react';
import { Building2Icon, CameraIcon, XIcon } from 'lucide-react';
import { optimizeImageUrl } from '@/utils/cloudinary-url';

function getLogoImageSrc(value: string, displaySize: number): string {
  // 임시 URL (업로드 프리뷰)
  if (value.includes('res.cloudinary.com')) {
    return optimizeImageUrl(value, { width: displaySize }) || value;
  }
  // /assets/ 경로
  return value;
}

const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (리사이징 전 원본 허용)
const OUTPUT_SIZE = 400; // 출력 이미지 크기 (px)
const OUTPUT_QUALITY = 0.85; // JPEG 퀄리티 (0-1)
const LOGO_DISPLAY_SIZE = 96; // 표시 크기 (px)

async function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // 정사각형 크롭 + 리사이징
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // 중앙 기준 정사각형 크롭
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;

      ctx.drawImage(img, sx, sy, size, size, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          }
          else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        OUTPUT_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  onPublicIdChange?: (publicId: string | null) => void;
  disabled?: boolean;
  /** 기존에 저장된 이미지 URL (서버에서 생성된 전체 URL) */
  currentImageUrl?: string | null;
}

export default function OrganizationLogoUpload({ value, onChange, onPublicIdChange, disabled, currentImageUrl }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [publicId, setPublicId] = React.useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (file.size > MAX_FILE_SIZE) {
      setError('파일 크기는 10MB 이하여야 합니다.');
      return;
    }

    if (!ALLOWED_FORMATS.includes(file.type)) {
      setError('JPG, PNG, WebP 형식만 지원합니다.');
      return;
    }

    setIsUploading(true);

    try {
      // 이미지 리사이징 및 압축
      const resizedBlob = await resizeImage(file);
      const resizedFile = new File([resizedBlob], 'logo.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', resizedFile);

      const response = await fetch('/api/organizations/logo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '업로드에 실패했습니다.');
      }
      else {
        onChange(data.url);
        setPublicId(data.publicId);
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
    setPublicId(null);
    onPublicIdChange?.(null);
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
          <div className="size-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
            {hasImage ? (
              <img
                src={getLogoImageSrc(displayImageUrl, LOGO_DISPLAY_SIZE)}
                alt="조직 로고"
                className="size-full object-cover"
              />
            ) : (
              <Building2Icon className="size-10 text-gray-400" />
            )}
          </div>

          {isUploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
              <Spinner size="sm" color="white" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
              <CameraIcon className="size-6 text-white" />
            </div>
          )}

          {hasImage && !isUploading && (
            <button
              type="button"
              onClick={handleDelete}
              className="absolute -top-2 -right-2 size-6 rounded-full bg-danger-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger-600"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>

        <div className="text-xs text-gray-500">
          <p>권장 크기: 400 x 400px</p>
          <p>최대 10MB (JPG, PNG, WebP)</p>
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
