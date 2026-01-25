import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleService } from './google.service';
import { GoogleCalendarService } from './services/google-calendar.service';

@Injectable()
export class GoogleSchedulerService {
  private readonly logger = new Logger(GoogleSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleService: GoogleService,
    private readonly calendarService: GoogleCalendarService,
  ) {}

  // 매일 새벽 3시 실행 (KST) - UTC 18:00 = KST 03:00
  @Cron('0 18 * * *')
  async renewExpiringWebhooks() {
    this.logger.log('Starting webhook renewal check...');

    // 2일 이내 만료되는 webhook 조회
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    const expiringTokens = await this.prisma.googleSyncToken.findMany({
      where: {
        webhookExpiration: { lt: twoDaysFromNow },
        calendarId: { not: null },
      },
    });

    this.logger.log(`Found ${expiringTokens.length} expiring webhooks`);

    for (const token of expiringTokens) {
      try {
        const accessToken = await this.googleService.getAccessToken(token.userId);
        if (!accessToken || !token.calendarId) {
          continue;
        }

        await this.calendarService.registerWatch(
          token.userId,
          token.calendarId,
          accessToken,
        );
        this.logger.log(`Renewed webhook for user ${token.userId}`);
      }
      catch (err) {
        this.logger.error(`Failed to renew webhook for user ${token.userId}:`, err);
      }
    }

    this.logger.log('Webhook renewal check completed');
  }
}
