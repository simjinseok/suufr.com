import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * URL에서 public_id 추출
   */
  private extractPublicId(url: string): string | null {
    // https://res.cloudinary.com/{cloud}/image/upload/{version}/{public_id}.{ext}
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    return match ? match[1] : null;
  }

  /**
   * Base64 이미지 데이터를 Cloudinary에 업로드
   * @param base64Data - base64 인코딩된 이미지 데이터
   * @param mediaType - 이미지 MIME type (기본값: image/jpeg)
   * @returns 업로드된 이미지의 secure URL 또는 null
   */
  async uploadPhoto(base64Data: string, mediaType = 'image/jpeg'): Promise<string | null> {
    try {
      const key = randomUUID();
      const publicId = `suufr/images/${key}`;

      const result = await cloudinary.uploader.upload(
        `data:${mediaType};base64,${base64Data}`,
        { public_id: publicId, resource_type: 'image' },
      );

      return result.secure_url;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      return null;
    }
  }

  /**
   * temp 폴더의 이미지를 images 폴더로 이동
   * @param tempUrl - temp 폴더에 있는 Cloudinary URL
   * @returns 새로운 Cloudinary URL 또는 null
   */
  async moveFromTemp(tempUrl: string): Promise<string | null> {
    const publicId = this.extractPublicId(tempUrl);
    if (!publicId || !publicId.startsWith('suufr/temp/')) {
      console.error('Invalid temp URL:', tempUrl);
      return null;
    }

    const key = randomUUID();
    const newPublicId = `suufr/images/${key}`;

    try {
      const result = await cloudinary.uploader.rename(publicId, newPublicId, {
        invalidate: true,
      });
      return result.secure_url;
    } catch (error) {
      console.error('Move image error:', error);
      return null;
    }
  }

  /**
   * URL에서 public_id를 추출하여 이미지 삭제
   */
  async deleteByUrl(url: string): Promise<boolean> {
    try {
      const publicId = this.extractPublicId(url);
      if (!publicId) {
        console.error('Failed to extract public_id from URL:', url);
        return false;
      }
      await cloudinary.uploader.destroy(publicId, { invalidate: true });
      return true;
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      return false;
    }
  }
}
