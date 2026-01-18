import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const UPLOAD_CONFIG = {
  maxFileSize: 1 * 1024 * 1024, // 1MB
  allowedFormats: ['image/jpeg', 'image/png', 'image/webp'],
};

export type UploadResult = {
  success: true;
  url: string;
  publicId: string;
} | {
  success: false;
  error: string;
};

export async function uploadImage(file: File): Promise<UploadResult> {
  if (file.size > UPLOAD_CONFIG.maxFileSize) {
    return { success: false, error: '파일 크기는 1MB 이하여야 합니다.' };
  }

  if (!UPLOAD_CONFIG.allowedFormats.includes(file.type)) {
    return { success: false, error: 'JPG, PNG, WebP 형식만 지원합니다.' };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = `data:${file.type};base64,${buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(base64, {
      folder: 'suufr/temp',
      resource_type: 'image',
    });

    return { success: true, url: result.secure_url, publicId: result.public_id };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return { success: false, error: '이미지 업로드에 실패했습니다.' };
  }
}

export async function moveImage(publicId: string): Promise<string | null> {
  const key = randomUUID();
  const newPublicId = `suufr/students/${key}`;

  try {
    await cloudinary.uploader.rename(publicId, newPublicId, {
      invalidate: true,
    });
    return key;
  } catch (error) {
    console.error('Move image error:', error);
    return null;
  }
}

export async function moveMemberImage(publicId: string): Promise<string | null> {
  const key = randomUUID();
  const newPublicId = `suufr/members/${key}`;

  try {
    await cloudinary.uploader.rename(publicId, newPublicId, {
      invalidate: true,
    });
    return key;
  } catch (error) {
    console.error('Move member image error:', error);
    return null;
  }
}

/**
 * Cloudinary에서 이미지 삭제
 *
 * @param key - 이미지 키 (UUID)
 * @param folder - 폴더 타입 ('students' | 'members')
 */
export async function deleteImage(key: string, folder: 'students' | 'members'): Promise<boolean> {
  const publicId = `suufr/${folder}/${key}`;

  try {
    await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
    });
    return true;
  } catch (error) {
    console.error('Delete image error:', error);
    return false;
  }
}
