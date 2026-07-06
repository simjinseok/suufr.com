import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * AES-256-GCM 대칭 암호화 (외부 서비스 토큰, 빌링키 등 민감 값 저장용)
 * 저장 형식: iv:authTag:encrypted (모두 base64)
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const encryptionKeyBase64 = this.configService.get<string>('TOKEN_ENCRYPTION_KEY');
    if (encryptionKeyBase64) {
      this.encryptionKey = Buffer.from(encryptionKeyBase64, 'base64');
    }
    else {
      this.logger.warn('TOKEN_ENCRYPTION_KEY not set, using fallback (not secure for production)');
      this.encryptionKey = crypto.scryptSync('fallback-key', 'salt', 32);
    }
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(encryptedText: string): string {
    const [ivBase64, authTagBase64, encryptedBase64] = encryptedText.split(':');
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
