import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Res,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { GoogleService } from './google.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { GoogleContactsService } from './services/google-contacts.service';
import { CurrentUser, Public } from '../common';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import type { SyncResult } from './dto';
import * as crypto from 'crypto';

// State storage (in production, use Redis or similar)
const stateStore = new Map<string, { userId: string; expiresAt: number }>();

// Clean up expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of stateStore.entries()) {
    if (value.expiresAt < now) {
      stateStore.delete(key);
    }
  }
}, 60 * 1000); // Every minute

@Controller('api/google')
export class GoogleController {
  private readonly logger = new Logger(GoogleController.name);

  constructor(
    private readonly googleService: GoogleService,
    private readonly calendarService: GoogleCalendarService,
    private readonly contactsService: GoogleContactsService,
  ) {}

  /**
   * GET /api/google/connect
   * Returns OAuth authorization URL
   */
  @Get('connect')
  connect(@CurrentUser() user: AuthenticatedUser) {
    // Generate secure state token
    const state = crypto.randomBytes(32).toString('hex');

    // Store state with user ID (expires in 10 minutes)
    stateStore.set(state, {
      userId: user.userId,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const authUrl = this.googleService.getAuthUrl(state);

    return {
      success: true,
      data: { authUrl },
    };
  }

  /**
   * GET /api/google/callback
   * OAuth callback handler
   */
  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: FastifyReply,
  ) {
    const webBaseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const redirectUrl = `${webBaseUrl}/settings/integrations`;

    if (error) {
      this.logger.warn(`OAuth error: ${error}`);
      return res.redirect(`${redirectUrl}?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${redirectUrl}?error=missing_params`);
    }

    // Validate state
    const storedState = stateStore.get(state);
    if (!storedState || storedState.expiresAt < Date.now()) {
      stateStore.delete(state);
      return res.redirect(`${redirectUrl}?error=invalid_state`);
    }

    const { userId } = storedState;
    stateStore.delete(state);

    try {
      // Exchange code for tokens
      const tokens = await this.googleService.exchangeCode(code);

      // Get user info
      const userInfo = await this.googleService.getUserInfo(tokens.access_token);

      // Save tokens
      await this.googleService.saveTokens(userId, tokens, userInfo);

      this.logger.log(`Google connected for user ${userId} (${userInfo.email})`);

      return res.redirect(`${redirectUrl}?success=true`);
    }
    catch (err) {
      this.logger.error('OAuth callback error:', err);
      return res.redirect(`${redirectUrl}?error=auth_failed`);
    }
  }

  /**
   * POST /api/google/exchange-code
   * Exchange OAuth code for tokens (called from Web callback)
   */
  @Post('exchange-code')
  async exchangeCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { code: string; state: string },
  ) {
    const { code, state } = body;

    if (!code || !state) {
      return { success: false, message: 'missing_params' };
    }

    // Validate state
    const storedState = stateStore.get(state);
    if (!storedState || storedState.expiresAt < Date.now()) {
      stateStore.delete(state);
      return { success: false, message: 'invalid_state' };
    }

    // Verify user matches
    if (storedState.userId !== user.userId) {
      this.logger.warn(`User mismatch: state userId ${storedState.userId} vs current user ${user.userId}`);
      return { success: false, message: 'user_mismatch' };
    }

    stateStore.delete(state);

    try {
      // Exchange code for tokens
      const tokens = await this.googleService.exchangeCode(code);

      // Get user info
      const userInfo = await this.googleService.getUserInfo(tokens.access_token);

      // Save tokens
      await this.googleService.saveTokens(user.userId, tokens, userInfo);

      this.logger.log(`Google connected for user ${user.userId} (${userInfo.email})`);

      // 자동 동기화 (백그라운드, 에러 무시)
      this.calendarService.syncAll(user.userId, tokens.access_token)
        .then(() => this.logger.log(`Initial sync completed for user ${user.userId}`))
        .catch(err => this.logger.error('Initial sync failed:', err));

      return { success: true };
    }
    catch (err) {
      this.logger.error('OAuth exchange-code error:', err);
      return { success: false, message: 'auth_failed' };
    }
  }

  /**
   * GET /api/google/status
   * Get connection status
   */
  @Get('status')
  async status(@CurrentUser() user: AuthenticatedUser) {
    const status = await this.googleService.getConnectionStatus(user.userId);
    return { success: true, data: status };
  }

  /**
   * DELETE /api/google/disconnect
   * Disconnect Google account
   */
  @Delete('disconnect')
  async disconnect(@CurrentUser() user: AuthenticatedUser) {
    await this.googleService.disconnect(user.userId);
    return { success: true };
  }

  /**
   * POST /api/google/sync/calendar
   * Manual calendar sync
   */
  @Post('sync/calendar')
  async syncCalendar(@CurrentUser() user: AuthenticatedUser): Promise<{ success: boolean; data: SyncResult }> {
    const accessToken = await this.googleService.getAccessToken(user.userId);
    if (!accessToken) {
      throw new BadRequestException('Google account not connected');
    }

    try {
      const result = await this.calendarService.syncAll(user.userId, accessToken);
      return { success: true, data: result };
    }
    catch (error) {
      this.logger.error(`Calendar sync failed for user ${user.userId}:`, error);
      throw new InternalServerErrorException('Calendar sync failed');
    }
  }

  /**
   * POST /api/google/sync/contacts
   * Manual contacts sync
   */
  @Post('sync/contacts')
  async syncContacts(@CurrentUser() user: AuthenticatedUser): Promise<{ success: boolean; data: SyncResult }> {
    const accessToken = await this.googleService.getAccessToken(user.userId);
    if (!accessToken) {
      throw new BadRequestException('Google account not connected');
    }

    try {
      const result = await this.contactsService.syncAll(user.userId, accessToken);
      return { success: true, data: result };
    }
    catch (error) {
      this.logger.error(`Contacts sync failed for user ${user.userId}:`, error);
      throw new InternalServerErrorException('Contacts sync failed');
    }
  }

  /**
   * POST /api/google/sync/all
   * Sync both calendar and contacts
   */
  @Post('sync/all')
  async syncAll(@CurrentUser() user: AuthenticatedUser): Promise<{ success: boolean; data: { calendar: SyncResult; contacts: SyncResult } }> {
    const accessToken = await this.googleService.getAccessToken(user.userId);
    if (!accessToken) {
      throw new BadRequestException('Google account not connected');
    }

    try {
      const [calendarResult, contactsResult] = await Promise.all([
        this.calendarService.syncAll(user.userId, accessToken),
        this.contactsService.syncAll(user.userId, accessToken),
      ]);

      return {
        success: true,
        data: {
          calendar: calendarResult,
          contacts: contactsResult,
        },
      };
    }
    catch (error) {
      this.logger.error(`Full sync failed for user ${user.userId}:`, error);
      throw new InternalServerErrorException('Sync failed');
    }
  }

  /**
   * POST /api/google/webhook/calendar
   * Webhook endpoint for Google Calendar notifications
   * Called by Web proxy endpoint
   */
  @Public()
  @Post('webhook/calendar')
  async calendarWebhook(
    @Body() body: { channelId: string; resourceState: string },
  ) {
    const { channelId, resourceState } = body;

    if (!channelId) {
      this.logger.warn('Webhook received without channelId');
      return { success: false };
    }

    this.logger.debug(`Calendar webhook: channel=${channelId}, state=${resourceState}`);

    // Process webhook in background
    this.calendarService.handleWebhook(channelId, resourceState)
      .catch(err => this.logger.error('Webhook processing failed:', err));

    // Always return 200 to acknowledge receipt
    return { success: true };
  }
}
