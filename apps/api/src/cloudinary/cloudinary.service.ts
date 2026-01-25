import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';

export type ResourceType = 'image' | 'video';

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
    // https://res.cloudinary.com/{cloud}/video/upload/{version}/{public_id}.{ext}
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    return match ? match[1] : null;
  }

  /**
   * URL에서 resource type 추출 (image/video)
   */
  private extractResourceType(url: string): ResourceType {
    if (url.includes('/video/upload/')) {
      return 'video';
    }
    return 'image';
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
    }
    catch (error) {
      console.error('Cloudinary upload error:', error);
      return null;
    }
  }

  /**
   * temp 폴더의 프로필 이미지를 images 폴더로 이동 (200x200 크롭 + 자동 품질)
   * @param tempUrl - temp 폴더에 있는 Cloudinary URL
   * @returns 새로운 Cloudinary URL 또는 null
   */
  async moveProfileImage(tempUrl: string): Promise<string | null> {
    const publicId = this.extractPublicId(tempUrl);
    if (!publicId || !publicId.startsWith('suufr/temp/')) {
      console.error('Invalid temp URL:', tempUrl);
      return null;
    }

    const key = randomUUID();
    const newPublicId = `suufr/images/${key}`;

    try {
      // temp URL에서 transformation 적용하여 새 이미지로 업로드
      const result = await cloudinary.uploader.upload(tempUrl, {
        public_id: newPublicId,
        transformation: [
          {
            crop: 'fill',
            width: 200,
            height: 200,
            quality: 'auto',
          },
        ],
        overwrite: true,
      });

      // 원본 temp 이미지 삭제
      await cloudinary.uploader.destroy(publicId, { invalidate: true });

      return result.secure_url;
    }
    catch (error) {
      console.error('Move profile image error:', error);
      return null;
    }
  }

  /**
   * temp 폴더의 로고 이미지를 images 폴더로 이동 (원본 유지)
   * @param tempUrl - temp 폴더에 있는 Cloudinary URL
   * @returns 새로운 Cloudinary URL 또는 null
   */
  async moveLogoImage(tempUrl: string): Promise<string | null> {
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
    }
    catch (error) {
      console.error('Move logo image error:', error);
      return null;
    }
  }

  /**
   * temp 폴더의 미디어 파일을 media 폴더로 이동 (이미지/동영상 모두 지원)
   * @param tempUrl - temp 폴더에 있는 Cloudinary URL
   * @param resourceType - 리소스 타입 ('image' | 'video')
   * @returns { url, publicId } 또는 null
   */
  async moveMediaFile(
    tempUrl: string,
    resourceType: ResourceType,
  ): Promise<{ url: string; publicId: string } | null> {
    const publicId = this.extractPublicId(tempUrl);
    if (!publicId || !publicId.startsWith('suufr/temp/')) {
      console.error('Invalid temp URL:', tempUrl);
      return null;
    }

    const key = randomUUID();
    const newPublicId = `suufr/media/${key}`;

    try {
      const result = await cloudinary.uploader.rename(publicId, newPublicId, {
        invalidate: true,
        resource_type: resourceType,
      });
      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    }
    catch (error) {
      console.error('Move media file error:', error);
      return null;
    }
  }

  /**
   * URL에서 public_id를 추출하여 파일 삭제
   * @param url - 삭제할 파일의 Cloudinary URL
   * @param resourceType - 리소스 타입 (기본값: 'image')
   */
  async deleteByUrl(url: string, resourceType?: ResourceType): Promise<boolean> {
    try {
      const publicId = this.extractPublicId(url);
      if (!publicId) {
        console.error('Failed to extract public_id from URL:', url);
        return false;
      }

      // resourceType이 제공되지 않으면 URL에서 추출
      const type = resourceType ?? this.extractResourceType(url);

      await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        resource_type: type,
      });
      return true;
    }
    catch (error) {
      console.error('Cloudinary delete error:', error);
      return false;
    }
  }
}
