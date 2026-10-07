import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsBillingService } from './subscriptions-billing.service';
import { SubscriptionsReconciliationService } from './subscriptions-reconciliation.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PaddleClient } from './paddle.client';
import { PaddleWebhookController } from './paddle-webhook.controller';
import { PaddleWebhookService } from './paddle-webhook.service';
import { BillingSyncService } from './billing-sync.service';

@Module({
  controllers: [SubscriptionsController, PaddleWebhookController],
  providers: [
    SubscriptionsService,
    SubscriptionsBillingService,
    SubscriptionsReconciliationService,
    BillingSyncService,
    PaddleClient,
    PaddleWebhookService,
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
