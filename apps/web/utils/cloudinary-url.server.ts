import 'server-only';

/**
 * Bunny CDN URL 유틸리티 (서버 전용)
 * process.env.NEXT_PUBLIC_CDN_URL 접근
 */

type FolderType = 'students' | 'organizations';

type BuildOptions = {
  width?: number;
  height?: number;
  quality?: 'auto' | number;
  format?: 'auto' | 'webp' | 'jpg' | 'png';
};

/**
 * 랜덤 키 + 폴더 타입으로 Bunny CDN URL 생성
 *
 * @param key - 랜덤 키 (UUID)
 * @param folder - 폴더 타입 ('students' | 'organizations')
 * @param options - 이미지 옵션
 */
export function buildCloudinaryUrl(
  key: string | null,
  folder: FolderType,
  options?: BuildOptions,
): string | null {
  if (!key) return null;

  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
  if (!cdnUrl) return null;

  const { width = 112, height, quality = 'auto', format = 'webp' } = options || {};

  // Bunny Optimizer 쿼리 파라미터 생성
  const qualityValue = quality === 'auto' ? 80 : quality;
  const params = new URLSearchParams();
  params.set('width', String(width));
  params.set('height', String(height || width));
  params.set('quality', String(qualityValue));
  params.set('format', format);

  // 모든 폴더를 'images'로 매핑
  return `${cdnUrl}/images/${key}?${params.toString()}`;
}

/**
 * URL에서 랜덤 키 추출 (마이그레이션용)
 *
 * @param url - Bunny CDN URL 또는 랜덤 키
 * @returns 랜덤 키 또는 null
 */
export function extractKeyFromUrl(url: string | null): string | null {
  if (!url) return null;

  // 이미 키인 경우 (URL이 아닌 경우)
  if (!url.includes('://')) {
    return url;
  }

  // Bunny CDN URL에서 키 추출
  // 예: https://cdn.example.com/images/abc.jpg?params -> abc
  // 또는 Cloudinary URL: https://res.cloudinary.com/xxx/image/upload/suufr/students/abc.jpg -> abc
  
  // Bunny CDN 패턴
  let match = url.match(/\/images\/([^/?]+)/);
  if (match) return match[1];

  // Cloudinary 패턴 (호환성)
  match = url.match(/suufr\/(?:students|organizations)\/([^./?]+)/);
  if (match) return match[1];

  return null;
}
