/**
 * Cloudinary URL 유틸리티 (클라이언트에서도 사용 가능)
 *
 * 서버 전용 함수는 cloudinary-url.server.ts 참조
 */

type ImageOptions = {
  width: number;
  height?: number;
  quality?: 'auto' | number;
  format?: 'auto' | 'webp' | 'jpg' | 'png';
};

/**
 * Cloudinary 이미지 URL을 최적화된 URL로 변환
 *
 * @example
 * optimizeImageUrl('https://res.cloudinary.com/.../image.jpg', { width: 160 })
 * // => 'https://res.cloudinary.com/.../w_160,h_160,c_fill,f_auto,q_auto/image.jpg'
 */
export function optimizeImageUrl(
  url: string | null | undefined,
  options: ImageOptions,
): string | null {
  if (!url) return null;

  // Cloudinary URL인지 확인
  if (!url.includes('res.cloudinary.com')) {
    return url;
  }

  const { width, height = width, quality = 'auto', format = 'auto' } = options;

  // 변환 파라미터 생성
  const transforms = [
    `w_${width}`,
    `h_${height}`,
    'c_fill', // 크롭 모드: 비율 유지하며 채우기
    `f_${format}`,
    `q_${quality}`,
  ].join(',');

  // /upload/ 뒤에 변환 파라미터 삽입
  return url.replace('/upload/', `/upload/${transforms}/`);
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
