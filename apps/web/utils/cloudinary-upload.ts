/**
 * 브라우저에서 Cloudinary로 직접 업로드하는 유틸
 * unsigned preset을 사용하여 서버를 거치지 않고 업로드
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export type UploadResult = {
  success: true;
  url: string;
  publicId: string;
} | {
  success: false;
  error: string;
};

/**
 * 파일을 Cloudinary temp 폴더로 직접 업로드
 * @param file - 업로드할 파일
 * @returns 업로드 결과 (성공 시 URL과 publicId 포함)
 */
export async function uploadToCloudinary(file: File): Promise<UploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    return { success: false, error: 'Cloudinary 설정이 누락되었습니다.' };
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
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
    };
  }
  catch (error) {
    console.error('Cloudinary upload error:', error);
    return { success: false, error: '업로드 중 오류가 발생했습니다.' };
  }
}
