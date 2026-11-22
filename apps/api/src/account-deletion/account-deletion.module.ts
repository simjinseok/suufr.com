import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { GoogleModule } from '../google/google.module';
import { S3Module } from '../s3/s3.module';
import { MailModule } from '../mail/mail.module';
import { AccountDeletionController } from './account-deletion.controller';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionOtpService } from './account-deletion-otp.service';
import { AccountDeletionCleanupService } from './account-deletion-cleanup.service';

@Module({
  imports: [AuthModule, SubscriptionsModule, GoogleModule, S3Module, MailModule],
  controllers: [AccountDeletionController],
  providers: [AccountDeletionService, AccountDeletionOtpService, AccountDeletionCleanupService],
})
export class AccountDeletionModule {}
