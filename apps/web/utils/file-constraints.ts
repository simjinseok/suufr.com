/**
 * 미디어 파일 업로드 제약 (허용 타입 + 크기 제한).
 * apps/api 의 동일 상수(common/constants/file-constraints.ts)와 값이 일치해야 한다.
 */
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const SUPPORTED_DOCUMENT_TYPES = ['application/pdf'];

export const SUPPORTED_UPLOAD_TYPES = [
  ...SUPPORTED_IMAGE_TYPES,
  ...SUPPORTED_VIDEO_TYPES,
  ...SUPPORTED_DOCUMENT_TYPES,
];

/** input[accept] 속성용 문자열 */
export const UPLOAD_ACCEPT_ATTR = SUPPORTED_UPLOAD_TYPES.join(',');

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB (PDF)
