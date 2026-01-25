/**
 * 브라우저에서 Cloudinary로 직접 업로드하는 유틸
 * unsigned preset을 사용하여 서버를 거치지 않고 업로드
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export type ResourceType = 'image' | 'video';

export type UploadResult = {
  success: true;
  url: string;
  publicId: string;
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
 * 파일을 Cloudinary temp 폴더로 직접 업로드
 * @param file - 업로드할 파일
 * @returns 업로드 결과 (성공 시 URL, publicId, resourceType, fileSize 포함)
 */
export async function uploadToCloudinary(file: File): Promise<UploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    return { success: false, error: 'Cloudinary 설정이 누락되었습니다.' };
  }

  // 파일 유효성 검사
  const validation = validateFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const resourceType = getResourceType(file)!;

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    // auto/upload 엔드포인트 사용 (이미지/동영상 모두 지원)
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
      {
        method: 'POST',
        body: formData,
      },
    );

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error?.message || '업로드에 실패했습니다.' };
    }

    const data = await response.json();
    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
      resourceType,
      fileSize: data.bytes,
    };
  }
  catch (error) {
    console.error('Cloudinary upload error:', error);
    return { success: false, error: '업로드 중 오류가 발생했습니다.' };
  }
}
