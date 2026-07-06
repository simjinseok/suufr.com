import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsBillingService } from './subscriptions-billing.service';
import { SubscriptionsController } from './subscriptions.controller';
import { TossClient } from './toss.client';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionsBillingService, TossClient],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
