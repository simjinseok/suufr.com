/**
 * Bunny CDN URL 유틸리티 (클라이언트에서도 사용 가능)
 */

type ImageOptions = {
  width: number;
  height?: number;
  quality?: 'auto' | number;
  format?: 'auto' | 'webp' | 'jpg' | 'png';
};

/**
 * Bunny CDN 이미지 URL을 최적화된 URL로 변환
 *
 * @example
 * optimizeImageUrl('https://cdn.example.com/images/abc.jpg', { width: 160 })
 * // => 'https://cdn.example.com/images/abc.jpg?width=160&height=160&quality=80&format=auto'
 */
export function optimizeImageUrl(
  url: string | null | undefined,
  options: ImageOptions,
): string | null {
  if (!url) return null;

  // Bunny CDN URL인지 확인 (NEXT_PUBLIC_CDN_URL 기반)
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
  if (!cdnUrl || !url.includes(cdnUrl)) {
    return url;
  }

  const { width, height = width, quality = 'auto', format = 'auto' } = options;
  const qualityValue = quality === 'auto' ? 80 : quality;

  // Bunny Optimizer 쿼리 파라미터 생성
  const params = new URLSearchParams();
  params.set('width', String(width));
  params.set('height', String(height));
  params.set('quality', String(qualityValue));
  params.set('format', format);

  // 기존 쿼리 파라미터 제거 후 새 파라미터 추가
  const baseUrl = url.split('?')[0];
  return `${baseUrl}?${params.toString()}`;
}

/**
 * 아바타 이미지 최적화 (2x 레티나 대응)
 *
 * @param url - 원본 이미지 URL
 * @param displaySize - 화면에 표시될 크기 (px)
 */
export function optimizeAvatarUrl(
  url: string | null | undefined,
  displaySize: number,
): string | null {
  return optimizeImageUrl(url, {
    width: displaySize * 2, // 2x for retina
    quality: 'auto',
    format: 'auto',
  });
}
