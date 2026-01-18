import 'server-only';

/**
 * Cloudinary URL 유틸리티 (서버 전용)
 * process.env.CLOUDINARY_CLOUD_NAME 접근
 */

type FolderType = 'students' | 'members';

type BuildOptions = {
  width?: number;
  height?: number;
  quality?: 'auto' | number;
  format?: 'auto' | 'webp' | 'jpg' | 'png';
};

/**
 * 랜덤 키 + 폴더 타입으로 Cloudinary URL 생성
 *
 * @param key - 랜덤 키 (UUID)
 * @param folder - 폴더 타입 ('students' | 'members')
 * @param options - 이미지 옵션
 */
export function buildCloudinaryUrl(
  key: string | null,
  folder: FolderType,
  options?: BuildOptions,
): string | null {
  if (!key) return null;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return null;

  const { width = 112, height, quality = 'auto', format = 'webp' } = options || {};

  // 변환 파라미터 생성
  const transforms = [
    `w_${width}`,
    `h_${height || width}`,
    'c_fill',
    `f_${format}`,
    `q_${quality}`,
  ].join(',');

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/suufr/${folder}/${key}`;
}

/**
 * URL에서 랜덤 키 추출 (마이그레이션용)
 *
 * @param url - Cloudinary URL 또는 랜덤 키
 * @returns 랜덤 키 또는 null
 */
export function extractKeyFromUrl(url: string | null): string | null {
  if (!url) return null;

  // 이미 키인 경우 (URL이 아닌 경우)
  if (!url.includes('://')) {
    return url;
  }

  // Cloudinary URL에서 키 추출
  // 예: https://res.cloudinary.com/xxx/image/upload/suufr/students/abc.jpg -> abc
  const match = url.match(/suufr\/(?:students|members)\/([^.]+)/);
  return match ? match[1] : null;
}
