/**
 * Content-Type(MIME)을 스토리지 폴더 이름으로 매핑한다.
 */
export function folderByContentType(contentType: string): string {
  if (contentType.startsWith('image/')) return 'images';
  if (contentType.startsWith('video/')) return 'videos';
  if (contentType === 'application/pdf') return 'documents';
  return 'files';
}
