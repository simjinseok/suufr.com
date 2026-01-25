import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import type { GoogleTokenResponse, GoogleUserInfo, GoogleConnectionStatus } from './dto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

// OAuth Scopes
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.app.created',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
    this.redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI') ?? '';

    const encryptionKeyBase64 = this.configService.get<string>('TOKEN_ENCRYPTION_KEY');
    if (encryptionKeyBase64) {
      this.encryptionKey = Buffer.from(encryptionKeyBase64, 'base64');
    }
    else {
      this.logger.warn('TOKEN_ENCRYPTION_KEY not set, using fallback (not secure for production)');
      this.encryptionKey = crypto.scryptSync('fallback-key', 'salt', 32);
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<GoogleTokenResponse> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Token exchange failed: ${error}`);
      throw new Error('Failed to exchange authorization code');
    }

    return response.json() as Promise<GoogleTokenResponse>;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Token refresh failed: ${error}`);
      throw new Error('Failed to refresh access token');
    }

    return response.json() as Promise<GoogleTokenResponse>;
  }

  /**
   * Get user info from Google
   */
  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    return response.json() as Promise<GoogleUserInfo>;
  }

  /**
   * Save tokens to database (encrypted)
   */
  async saveTokens(
    userId: string,
    tokens: GoogleTokenResponse,
    userInfo: GoogleUserInfo,
  ): Promise<void> {
    const encryptedAccessToken = this.encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? this.encrypt(tokens.refresh_token)
      : null;
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await this.prisma.externalServiceToken.upsert({
      where: {
        userId_provider: {
          userId,
          provider: 'google',
        },
      },
      create: {
        userId,
        provider: 'google',
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        scope: tokens.scope,
        providerUserId: userInfo.id,
        providerEmail: userInfo.email,
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken ?? undefined,
        tokenExpiresAt,
        scope: tokens.scope,
        providerUserId: userInfo.id,
        providerEmail: userInfo.email,
        deletedAt: null,
      },
    });

    // Initialize sync token record if not exists
    await this.prisma.googleSyncToken.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  /**
   * Get valid access token (refreshes if expired)
   */
  async getAccessToken(userId: string): Promise<string | null> {
    const token = await this.prisma.externalServiceToken.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'google',
        },
        deletedAt: null,
      },
    });

    if (!token) {
      return null;
    }

    // Check if token is expired (with 5 minute buffer)
    const isExpired = token.tokenExpiresAt
      && token.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000;

    if (isExpired && token.refreshToken) {
      try {
        const refreshToken = this.decrypt(token.refreshToken);
        const newTokens = await this.refreshAccessToken(refreshToken);

        // Update stored tokens
        const encryptedAccessToken = this.encrypt(newTokens.access_token);
        const tokenExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

        await this.prisma.externalServiceToken.update({
          where: { id: token.id },
          data: {
            accessToken: encryptedAccessToken,
            tokenExpiresAt,
            // Only update refresh token if a new one was provided
            ...(newTokens.refresh_token && {
              refreshToken: this.encrypt(newTokens.refresh_token),
            }),
          },
        });

        return newTokens.access_token;
      }
      catch (error) {
        this.logger.error(`Failed to refresh token for user ${userId}:`, error);
        return null;
      }
    }

    return this.decrypt(token.accessToken);
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(userId: string): Promise<GoogleConnectionStatus> {
    const token = await this.prisma.externalServiceToken.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'google',
        },
        deletedAt: null,
      },
    });

    if (!token) {
      return { connected: false };
    }

    const syncToken = await this.prisma.googleSyncToken.findUnique({
      where: { userId },
    });

    return {
      connected: true,
      email: token.providerEmail ?? undefined,
      lastCalendarSyncAt: syncToken?.lastCalendarSyncAt,
      lastContactsSyncAt: syncToken?.lastContactsSyncAt,
    };
  }

  /**
   * Disconnect Google account
   */
  async disconnect(userId: string): Promise<void> {
    const accessToken = await this.getAccessToken(userId);
    const syncToken = await this.getSyncToken(userId);

    // 1. Webhook 구독 해제
    if (accessToken && syncToken?.webhookChannelId && syncToken?.webhookResourceId) {
      await this.stopWatch(syncToken.webhookChannelId, syncToken.webhookResourceId, accessToken)
        .catch(err => this.logger.error('Failed to stop watch:', err));
    }

    // 2. Google Calendar 삭제
    if (accessToken && syncToken?.calendarId) {
      await this.deleteCalendar(syncToken.calendarId, accessToken);
    }

    // 3. DB 데이터 삭제
    await this.prisma.$transaction([
      this.prisma.externalServiceToken.updateMany({
        where: { userId, provider: 'google', deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.prisma.googleSyncToken.deleteMany({ where: { userId } }),
      this.prisma.sessionGoogleEvent.deleteMany({ where: { userId } }),
      this.prisma.studentGoogleContact.deleteMany({ where: { userId } }),
    ]);
  }

  /**
   * Delete a calendar from Google Calendar
   */
  private async deleteCalendar(calendarId: string, accessToken: string): Promise<void> {
    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    // 404 is ok - calendar already deleted
    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Failed to delete calendar: ${error}`);
    }
  }

  /**
   * Stop watching a calendar channel
   */
  private async stopWatch(
    channelId: string,
    resourceId: string,
    accessToken: string,
  ): Promise<void> {
    const response = await fetch(`${CALENDAR_API_BASE}/channels/stop`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: channelId, resourceId }),
    });

    if (!response.ok && response.status !== 404) {
      this.logger.error(`Failed to stop watch: ${await response.text()}`);
    }
  }

  /**
   * Get sync token record
   */
  async getSyncToken(userId: string) {
    return this.prisma.googleSyncToken.findUnique({
      where: { userId },
    });
  }

  /**
   * Update sync token
   */
  async updateSyncToken(
    userId: string,
    data: {
      calendarSyncToken?: string | null;
      calendarId?: string;
      contactsSyncToken?: string | null;
      lastCalendarSyncAt?: Date;
      lastContactsSyncAt?: Date;
      webhookChannelId?: string | null;
      webhookResourceId?: string | null;
      webhookExpiration?: Date | null;
    },
  ) {
    return this.prisma.googleSyncToken.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  /**
   * Find user by webhook channel ID
   */
  async findUserByWebhookChannel(channelId: string): Promise<string | null> {
    const syncToken = await this.prisma.googleSyncToken.findFirst({
      where: { webhookChannelId: channelId },
      select: { userId: true },
    });
    return syncToken?.userId ?? null;
  }

  // AES-256-GCM encryption
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private decrypt(encryptedText: string): string {
    const [ivBase64, authTagBase64, encryptedBase64] = encryptedText.split(':');
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
