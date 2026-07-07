/**
 * 미디어 파일 업로드 제약 (허용 타입 + 크기 제한).
 * apps/web 의 동일 상수(utils/file-constraints.ts)와 값이 일치해야 한다.
 */
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const SUPPORTED_DOCUMENT_TYPES = ['application/pdf'];

export const SUPPORTED_UPLOAD_TYPES = [
  ...SUPPORTED_IMAGE_TYPES,
  ...SUPPORTED_VIDEO_TYPES,
  ...SUPPORTED_DOCUMENT_TYPES,
];

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB (PDF)

/** MediaFile type 별 최대 크기 */
export const MAX_SIZE_BY_TYPE: Record<'image' | 'video' | 'document', number> = {
  image: MAX_IMAGE_SIZE,
  video: MAX_VIDEO_SIZE,
  document: MAX_DOCUMENT_SIZE,
};
