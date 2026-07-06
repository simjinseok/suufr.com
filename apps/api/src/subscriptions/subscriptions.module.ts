import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { TossClient } from './toss.client';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, TossClient],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
