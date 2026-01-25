import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucketName = process.env.S3_BUCKET_NAME!;
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
    } catch (error) {
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
    } catch (error) {
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
      const s3Key = `images/${key}`;

      const buffer = Buffer.from(base64Data, 'base64');

      return await this.uploadFile(s3Key, buffer, mediaType);
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error('S3 delete by URL error:', error);
      return false;
    }
  }

  /**
   * Move file from source to destination (copy + delete)
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
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: sourceKey,
      });

      await this.s3Client.send(deleteCommand);

      return true;
    } catch (error) {
      console.error('S3 move file error:', error);
      return false;
    }
  }

  /**
   * Move profile image from temp to images folder
   * @param tempUrl - Temporary S3 URL
   * @returns New S3 URL or null
   */
  async moveProfileImage(tempUrl: string): Promise<string | null> {
    const sourceKey = this.extractKeyFromUrl(tempUrl);
    if (!sourceKey || !sourceKey.startsWith('temp/')) {
      console.error('Invalid temp URL:', tempUrl);
      return null;
    }

    const key = randomUUID();
    const destKey = `images/${key}`;

    try {
      const success = await this.moveFile(sourceKey, destKey);
      if (!success) {
        return null;
      }

      return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${destKey}`;
    } catch (error) {
      console.error('Move profile image error:', error);
      return null;
    }
  }

  /**
   * Move logo image from temp to images folder
   * @param tempUrl - Temporary S3 URL
   * @returns New S3 URL or null
   */
  async moveLogoImage(tempUrl: string): Promise<string | null> {
    const sourceKey = this.extractKeyFromUrl(tempUrl);
    if (!sourceKey || !sourceKey.startsWith('temp/')) {
      console.error('Invalid temp URL:', tempUrl);
      return null;
    }

    const key = randomUUID();
    const destKey = `images/${key}`;

    try {
      const success = await this.moveFile(sourceKey, destKey);
      if (!success) {
        return null;
      }

      return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${destKey}`;
    } catch (error) {
      console.error('Move logo image error:', error);
      return null;
    }
  }

  /**
   * Move media file from temp to media folder
   * @param tempUrl - Temporary S3 URL
   * @returns { url, key } or null
   */
  async moveMediaFile(
    tempUrl: string,
  ): Promise<{ url: string; key: string } | null> {
    const sourceKey = this.extractKeyFromUrl(tempUrl);
    if (!sourceKey || !sourceKey.startsWith('temp/')) {
      console.error('Invalid temp URL:', tempUrl);
      return null;
    }

    const key = randomUUID();
    const destKey = `media/${key}`;

    try {
      const success = await this.moveFile(sourceKey, destKey);
      if (!success) {
        return null;
      }

      const url = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${destKey}`;
      return { url, key: destKey };
    } catch (error) {
      console.error('Move media file error:', error);
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
    } catch (error) {
      console.error('Failed to extract key from URL:', url, error);
      return null;
    }
  }
}
