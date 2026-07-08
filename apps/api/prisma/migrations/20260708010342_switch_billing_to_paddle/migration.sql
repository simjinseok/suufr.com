-- 토스페이먼츠 빌링 → Paddle Billing 전환
-- 전제: subscription_orders가 비어 있음 (결제 미오픈). 행이 남아 있으면
-- paddle_transaction_id NOT NULL 추가에서 실패하므로 먼저 비우고 재실행할 것

-- DropIndex
DROP INDEX "subscription_orders_order_id_key";

-- AlterTable
ALTER TABLE "subscription_orders" DROP COLUMN "order_id",
DROP COLUMN "payment_key",
DROP COLUMN "receipt_url",
ADD COLUMN     "paddle_transaction_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "user_subscriptions" DROP COLUMN "billing_key",
DROP COLUMN "card_company",
DROP COLUMN "card_number_masked",
ADD COLUMN     "paddle_customer_id" TEXT,
ADD COLUMN     "paddle_last_event_at" TIMESTAMPTZ(0),
ADD COLUMN     "paddle_subscription_id" TEXT;

-- CreateTable
CREATE TABLE "paddle_webhook_events" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(0) NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paddle_webhook_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_orders_paddle_transaction_id_key" ON "subscription_orders"("paddle_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_subscriptions_paddle_subscription_id_key" ON "user_subscriptions"("paddle_subscription_id");
