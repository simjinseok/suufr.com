import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectTaggingCommand,
  HeadObjectCommand,
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
import { folderByContentType } from '../common/utils/content-type';

/**
 * 등록 전 업로드 객체에 붙는 태그.
 * S3 라이프사이클 룰이 이 태그가 남은(=등록되지 않은) 객체를 1일 후 회수한다.
 * 룰 설정은 docs/s3-pending-lifecycle.md 참고.
 */
export const PENDING_UPLOAD_TAG = 'status=pending';

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
  }

  /**
   * Generate presigned URL for client-side upload
   *
   * 업로드 직후의 객체에는 status=pending 태그가 붙는다. 등록(POST /files)이 태그를
   * 제거하기 전까지는 라이프사이클 룰의 회수 대상 (docs/s3-pending-lifecycle.md 참고).
   *
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
        Tagging: PENDING_UPLOAD_TAG,
      });

      // x-amz-tagging은 쿼리 파라미터로 호이스팅되면 S3가 무시하므로 서명 헤더에 남긴다.
      // 그 결과 클라이언트가 같은 값의 헤더를 보내지 않으면 403 → 태그 누락이 조용히 지나가지 않는다.
      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn,
        unhoistableHeaders: new Set(['x-amz-tagging']),
      });
      return url;
    }
    catch (error) {
      console.error('S3 presigned URL generation error:', error);
      throw error;
    }
  }

  /**
   * presigned PUT 시 클라이언트가 그대로 에코해야 하는 서명 헤더
   */
  getPresignedUploadRequiredHeaders(): Record<string, string> {
    return { 'x-amz-tagging': PENDING_UPLOAD_TAG };
  }

  /**
   * 객체의 태그 전체 제거 (pending 태그 해제 = 라이프사이클 회수 대상에서 제외)
   * @returns 성공 여부
   */
  async clearObjectTags(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(new DeleteObjectTaggingCommand({
        Bucket: this.bucketName,
        Key: key,
      }));
      return true;
    }
    catch (error) {
      console.error('S3 clearObjectTags error:', error);
      return false;
    }
  }

  /**
   * Retrieve object metadata from S3 (existence, real size, content type).
   * Used to make file registration server-authoritative instead of trusting the client.
   * @param key - S3 object key
   * @returns { contentLength, contentType } or null if the object doesn't exist / on error
   */
  async headObject(
    key: string,
  ): Promise<{ contentLength: number; contentType: string | undefined } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const res = await this.s3Client.send(command);
      return {
        contentLength: res.ContentLength ?? 0,
        contentType: res.ContentType,
      };
    }
    catch (error) {
      console.error('S3 headObject error:', error);
      return null;
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
      const folder = folderByContentType(mediaType);
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
    }
    catch (error) {
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
