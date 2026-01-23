'use client';

import * as React from 'react';
import { Avatar, Spinner } from '@heroui/react';
import { CameraIcon, XIcon } from 'lucide-react';
import { optimizeAvatarUrl } from '@/utils/cloudinary-url';
import { uploadToCloudinary } from '@/utils/cloudinary-upload';

function getProfileImageSrc(value: string, displaySize: number): string {
  // Cloudinary URL인 경우 최적화
  if (value.includes('res.cloudinary.com')) {
    return optimizeAvatarUrl(value, displaySize) || value;
  }
  // 그 외의 URL은 그대로 반환
  return value;
}

const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (리사이징 전 원본 허용)
const OUTPUT_SIZE = 400; // 출력 이미지 크기 (px)
const OUTPUT_QUALITY = 0.8; // JPEG 퀄리티 (0-1)
const AVATAR_DISPLAY_SIZE = 56; // HeroUI Avatar size="lg"

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
  name: string;
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export default function ProfileImageUpload({ name, value, onChange, disabled }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
      const resizedFile = new File([resizedBlob], 'profile.jpg', { type: 'image/jpeg' });

      // Cloudinary로 직접 업로드
      const result = await uploadToCloudinary(resizedFile);

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

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setError(null);
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      inputRef.current?.click();
    }
  };

  const initial = name ? name.charAt(name.length - 1) : '?';

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative cursor-pointer group"
        onClick={handleClick}
      >
        <Avatar size="lg">
          {value
            ? <Avatar.Image src={getProfileImageSrc(value, AVATAR_DISPLAY_SIZE)} alt={name} />
            : null}
          <Avatar.Fallback>{initial}</Avatar.Fallback>
        </Avatar>

        {isUploading
          ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <Spinner size="sm" color="white" />
              </div>
            )
          : (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <CameraIcon className="size-6 text-white" />
              </div>
            )}

        {value && !isUploading && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-1 -right-1 size-6 flex items-center justify-center bg-danger-500 text-white rounded-full shadow-xs hover:bg-danger-600 transition-colors"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
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
      <input type="hidden" name="profileImageUrl" value={value || ''} />
    </div>
  );
}
