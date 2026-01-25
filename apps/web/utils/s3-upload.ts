/**
 * 브라우저에서 S3로 직접 업로드하는 유틸
 * presigned URL을 사용하여 서버를 거치지 않고 업로드
 */

export type ResourceType = 'image' | 'video';

export type UploadResult = {
  success: true;
  url: string;
  key: string;
  resourceType: ResourceType;
  fileSize: number;
} | {
  success: false;
  error: string;
};

// 지원되는 파일 형식
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

// 파일 크기 제한 (바이트)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * 파일의 리소스 타입 확인
 */
export function getResourceType(file: File): ResourceType | null {
  if (SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    return 'image';
  }
  if (SUPPORTED_VIDEO_TYPES.includes(file.type)) {
    return 'video';
  }
  return null;
}

/**
 * 파일 유효성 검사
 */
export function validateFile(file: File): { valid: true } | { valid: false; error: string } {
  const resourceType = getResourceType(file);

  if (!resourceType) {
    return { valid: false, error: '지원하지 않는 파일 형식입니다.' };
  }

  if (resourceType === 'image' && file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: '이미지는 10MB 이하만 업로드할 수 있습니다.' };
  }

  if (resourceType === 'video' && file.size > MAX_VIDEO_SIZE) {
    return { valid: false, error: '동영상은 100MB 이하만 업로드할 수 있습니다.' };
  }

  return { valid: true };
}

/**
 * 파일을 S3로 직접 업로드
 * @param file - 업로드할 파일
 * @param options - 업로드 옵션 (진행률 콜백 등)
 * @returns 업로드 결과 (성공 시 URL, key, resourceType, fileSize 포함)
 */
export async function uploadToS3(
  file: File,
  options?: {
    onProgress?: (percentage: number) => void;
  }
): Promise<UploadResult> {
  // 1. 클라이언트 측 유효성 검사
  const validation = validateFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const resourceType = getResourceType(file)!;

  try {
    // 2. presigned URL 요청
    const presignedResponse = await fetch('/api/storage/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      }),
    });

    if (!presignedResponse.ok) {
      const error = await presignedResponse.json();
      return {
        success: false,
        error: error.message || '업로드 URL 생성에 실패했습니다.',
      };
    }

    const { data } = await presignedResponse.json();
    const { presignedUrl, key } = data;

    // 3. S3로 직접 업로드
    await uploadToS3Direct(presignedUrl, file, file.type, options?.onProgress);

    // 4. Bunny CDN URL 생성 및 반환
    const cdnUrl = getS3PublicUrl(key);

    return {
      success: true,
      url: cdnUrl,
      key,
      resourceType,
      fileSize: file.size,
    };
  }
  catch (error) {
    console.error('S3 upload error:', error);
    return { success: false, error: '업로드 중 오류가 발생했습니다.' };
  }
}

/**
 * presigned URL을 사용하여 S3로 직접 업로드
 */
async function uploadToS3Direct(
  presignedUrl: string,
  file: File,
  contentType: string,
  onProgress?: (percentage: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // 진행률 추적
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        onProgress(percentage);
      }
    });

    // 업로드 완료
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    // 업로드 실패
    xhr.addEventListener('error', () => reject(new Error('Upload failed')));

    // PUT 요청으로 S3에 업로드
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file);
  });
}

/**
 * S3 key로부터 Bunny CDN URL 생성
 */
export function getS3PublicUrl(key: string): string {
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
  if (!cdnUrl) {
    throw new Error('NEXT_PUBLIC_CDN_URL environment variable is not set');
  }
  return `${cdnUrl}/${key}`;
}
