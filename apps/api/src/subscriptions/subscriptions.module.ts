import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsBillingService } from './subscriptions-billing.service';
import { SubscriptionsRenewalService } from './subscriptions-renewal.service';
import { SubscriptionsController } from './subscriptions.controller';
import { TossClient } from './toss.client';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionsBillingService, SubscriptionsRenewalService, TossClient],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
