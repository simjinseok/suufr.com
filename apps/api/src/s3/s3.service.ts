import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  getSignedUrl as getCloudFrontSignedUrl,
  getSignedCookies as getCloudFrontSignedCookies,
} from '@aws-sdk/cloudfront-signer';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly cloudFrontClient: CloudFrontClient;
  private readonly bucketName: string;
  private readonly distributionId: string | undefined;
  private readonly cloudFrontUrl: string | undefined;
  private readonly cloudFrontKeyPairId: string | undefined;
  private readonly cloudFrontPrivateKey: string | undefined;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_S3_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_S3_SECRET_KEY!,
      },
    });
    this.cloudFrontClient = new CloudFrontClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_S3_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_S3_SECRET_KEY!,
      },
    });
    this.bucketName = process.env.AWS_S3_BUCKET_NAME!;
    this.distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
    this.cloudFrontUrl = process.env.CLOUDFRONT_URL;
    this.cloudFrontKeyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
    // Private key may contain escaped newlines
    this.cloudFrontPrivateKey = process.env.CLOUDFRONT_PRIVATE_KEY?.replace(/\\n/g, '\n');

    // Debug: 환경변수 처리 확인 (임시 로그)
    console.log('[S3Service] CLOUDFRONT_PRIVATE_KEY raw (first 50):',
      JSON.stringify(process.env.CLOUDFRONT_PRIVATE_KEY?.substring(0, 50)));
    console.log('[S3Service] After replace (first 50):',
      JSON.stringify(this.cloudFrontPrivateKey?.substring(0, 50)));
  }

  /**
   * Generate presigned URL for client-side upload
   * @param key - S3 object key (e.g., 'temp/uuid.jpg')
   * @param contentType - MIME type (e.g., 'image/jpeg')
   * @param expiresIn - URL expiration in seconds (default: 300 = 5 minutes)
   * @returns Presigned PUT URL
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 300,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    }
    catch (error) {
      console.error('S3 presigned URL generation error:', error);
      throw error;
    }
  }

  /**
   * Upload file directly to S3 (server-side)
   * Used for CardDAV base64 uploads
   * @param key - S3 object key
   * @param body - File content as Buffer
   * @param contentType - MIME type
   * @returns S3 object URL or null on error
   */
  async uploadFile(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string | null> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      // Return the S3 URL (will be served via Bunny CDN)
      return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }
    catch (error) {
      console.error('S3 upload error:', error);
      return null;
    }
  }

  /**
   * Get folder name based on content type
   * @param contentType - MIME type
   * @returns Folder name
   */
  private getFolderByContentType(contentType: string): string {
    if (contentType.startsWith('image/')) return 'images';
    if (contentType.startsWith('video/')) return 'videos';
    if (contentType === 'application/pdf') return 'documents';
    return 'files'; // fallback
  }

  /**
   * Get file extension from content type
   * @param contentType - MIME type
   * @returns File extension with dot (e.g., '.png')
   */
  private getExtensionFromContentType(contentType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/webm': '.webm',
      'application/pdf': '.pdf',
    };
    return map[contentType] || '';
  }

  /**
   * Upload base64 image data to S3
   * @param base64Data - base64 encoded image data
   * @param mediaType - image MIME type (default: image/jpeg)
   * @returns Uploaded image URL or null
   */
  async uploadPhoto(
    base64Data: string,
    mediaType = 'image/jpeg',
  ): Promise<string | null> {
    try {
      const key = randomUUID();
      const folder = this.getFolderByContentType(mediaType);
      const s3Key = `${folder}/${key}`;

      const buffer = Buffer.from(base64Data, 'base64');

      return await this.uploadFile(s3Key, buffer, mediaType);
    }
    catch (error) {
      console.error('S3 photo upload error:', error);
      return null;
    }
  }

  /**
   * Delete file from S3
   * @param key - S3 object key
   * @returns true on success, false on error
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    }
    catch (error) {
      console.error('S3 delete error:', error);
      return false;
    }
  }

  /**
   * Delete file by URL
   * @param url - S3 URL to delete
   * @returns true on success, false on error
   */
  async deleteByUrl(url: string): Promise<boolean> {
    try {
      const key = this.extractKeyFromUrl(url);
      if (!key) {
        console.error('Failed to extract key from URL:', url);
        return false;
      }

      return await this.deleteFile(key);
    }
    catch (error) {
      console.error('S3 delete by URL error:', error);
      return false;
    }
  }

  /**
   * Move file from source to destination (copy + delete)
   * If source deletion fails, the copied file is rolled back to maintain atomicity.
   * @param sourceKey - Source S3 object key
   * @param destKey - Destination S3 object key
   * @returns true on success, false on error
   */
  async moveFile(sourceKey: string, destKey: string): Promise<boolean> {
    try {
      // Copy object to new location
      const copyCommand = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destKey,
      });

      await this.s3Client.send(copyCommand);

      // Delete original object
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: sourceKey,
        });

        await this.s3Client.send(deleteCommand);
      } catch (deleteError) {
        // Source deletion failed - rollback by deleting the copied file
        console.error('S3 source delete failed, rolling back copy:', deleteError);
        try {
          const rollbackCommand = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: destKey,
          });
          await this.s3Client.send(rollbackCommand);
        } catch (rollbackError) {
          console.error('S3 rollback delete failed:', rollbackError);
        }
        return false;
      }

      return true;
    }
    catch (error) {
      console.error('S3 move file error:', error);
      return false;
    }
  }

  /**
   * Move file from temp to appropriate folder based on content type
   * @param tempUrl - Temporary S3 URL
   * @param contentType - MIME type to determine destination folder
   * @param userId - Optional user ID for protected path (users/{userId}/...)
   * @returns { url, key } or null
   */
  async moveFileByContentType(
    tempUrl: string,
    contentType: string,
    userId?: string,
  ): Promise<{ url: string; key: string } | null> {
    const sourceKey = this.extractKeyFromUrl(tempUrl);
    if (!sourceKey || !sourceKey.startsWith('temp/')) {
      console.error('Invalid temp URL:', tempUrl);
      return null;
    }

    const folder = this.getFolderByContentType(contentType);
    const ext = this.getExtensionFromContentType(contentType);
    const key = randomUUID();
    // userId가 있으면 보호된 경로, 없으면 공개 경로
    const destKey = userId
      ? `users/${userId}/${folder}/${key}${ext}`
      : `${folder}/${key}${ext}`;

    try {
      const success = await this.moveFile(sourceKey, destKey);
      if (!success) {
        return null;
      }

      const url = `${process.env.CDN_URL}/${destKey}`;
      return { url, key: destKey };
    }
    catch (error) {
      console.error('Move file error:', error);
      return null;
    }
  }

  /**
   * Extract S3 key from URL
   * @param url - S3 URL
   * @returns S3 object key or null
   */
  private extractKeyFromUrl(url: string): string | null {
    try {
      // Handle S3 URLs: https://bucket.s3.region.amazonaws.com/key
      // or https://s3.region.amazonaws.com/bucket/key
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Remove leading slash
      const key = pathname.startsWith('/') ? pathname.slice(1) : pathname;

      return key || null;
    }
    catch (error) {
      console.error('Failed to extract key from URL:', url, error);
      return null;
    }
  }

  /**
   * Invalidate CloudFront cache for a given key
   * @param key - S3 object key to invalidate
   * @returns true on success, false on error (or if not configured)
   */
  async invalidateCloudFrontCache(key: string): Promise<boolean> {
    if (!this.distributionId) {
      console.warn('CLOUDFRONT_DISTRIBUTION_ID not configured, skipping cache invalidation');
      return true;
    }

    try {
      const command = new CreateInvalidationCommand({
        DistributionId: this.distributionId,
        InvalidationBatch: {
          CallerReference: `${key}-${Date.now()}`,
          Paths: {
            Quantity: 1,
            Items: [`/${key}`],
          },
        },
      });
      await this.cloudFrontClient.send(command);
      return true;
    } catch (error) {
      console.error('CloudFront cache invalidation failed:', error);
      return false;
    }
  }

  /**
   * Generate CloudFront Signed Cookies for a user
   * Allows access to users/{userId}/* path
   * @param userId - User ID
   * @param expiresInSeconds - Cookie expiration in seconds (default: 24 hours)
   * @returns Signed cookies object or null if not configured
   */
  getSignedCookiesForUser(
    userId: string,
    expiresInSeconds = 86400,
  ): { 'CloudFront-Policy': string; 'CloudFront-Signature': string; 'CloudFront-Key-Pair-Id': string } | null {
    if (!this.cloudFrontUrl || !this.cloudFrontKeyPairId || !this.cloudFrontPrivateKey) {
      console.warn('CloudFront signing not configured');
      return null;
    }

    const policy = JSON.stringify({
      Statement: [{
        Resource: `${this.cloudFrontUrl}/users/${userId}/*`,
        Condition: {
          DateLessThan: {
            'AWS:EpochTime': Math.floor(Date.now() / 1000) + expiresInSeconds,
          },
        },
      }],
    });

    const cookies = getCloudFrontSignedCookies({
      keyPairId: this.cloudFrontKeyPairId,
      privateKey: this.cloudFrontPrivateKey,
      policy,
    });

    // CloudFront signed cookies는 항상 이 3개의 쿠키를 반환
    return {
      'CloudFront-Policy': cookies['CloudFront-Policy']!,
      'CloudFront-Signature': cookies['CloudFront-Signature']!,
      'CloudFront-Key-Pair-Id': cookies['CloudFront-Key-Pair-Id']!,
    };
  }

  /**
   * Generate CloudFront Signed URL for a specific file
   * Used for shared links where cookies can't be used
   * @param key - S3 object key
   * @param expiresInSeconds - URL expiration in seconds (default: 1 hour)
   * @returns Signed URL or null if not configured
   */
  getSignedDownloadUrl(key: string, expiresInSeconds = 3600): string | null {
    if (!this.cloudFrontUrl || !this.cloudFrontKeyPairId || !this.cloudFrontPrivateKey) {
      console.warn('CloudFront signing not configured');
      return null;
    }

    const url = `${this.cloudFrontUrl}/${key}`;

    return getCloudFrontSignedUrl({
      url,
      keyPairId: this.cloudFrontKeyPairId,
      privateKey: this.cloudFrontPrivateKey,
      dateLessThan: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    });
  }

  /**
   * Check if CloudFront signing is configured
   */
  isSigningConfigured(): boolean {
    return !!(this.cloudFrontUrl && this.cloudFrontKeyPairId && this.cloudFrontPrivateKey);
  }
}
