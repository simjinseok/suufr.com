-- Paddle 전용 컬럼을 provider 중립으로 리네임·확장 (데이터 보존)
-- 설계: docs/superpowers/specs/2026-10-06-billing-provider-neutral-schema-design.md §8
-- Prisma 가 생성한 drop+add diff 는 쓰지 않는다

-- 열거형
CREATE TYPE "BillingProvider" AS ENUM ('paddle', 'apple', 'google', 'manual');
CREATE TYPE "BillingEnvironment" AS ENUM ('production', 'sandbox');
CREATE TYPE "BillingPeriodType" AS ENUM ('normal', 'trial', 'intro', 'promotional');
-- PG 12+ 는 트랜잭션 안에서 ADD VALUE 가능. 새 값은 이 마이그레이션 안에서 사용하지 않는다
ALTER TYPE "SubscriptionOrderStatus" ADD VALUE 'refunded';

-- user_subscriptions
ALTER TABLE "user_subscriptions" RENAME COLUMN "paddle_customer_id" TO "provider_customer_id";
ALTER TABLE "user_subscriptions" RENAME COLUMN "paddle_subscription_id" TO "provider_subscription_id";
ALTER TABLE "user_subscriptions" RENAME COLUMN "paddle_last_event_at" TO "provider_last_event_at";
ALTER TABLE "user_subscriptions"
  ADD COLUMN "provider" "BillingProvider",
  ADD COLUMN "provider_environment" "BillingEnvironment",
  ADD COLUMN "provider_product_id" TEXT,
  ADD COLUMN "provider_next_product_id" TEXT,
  ADD COLUMN "grace_period_expires_at" TIMESTAMPTZ(0),
  ADD COLUMN "billing_issue_detected_at" TIMESTAMPTZ(0),
  ADD COLUMN "period_type" "BillingPeriodType" NOT NULL DEFAULT 'normal';
-- 백필: Paddle 구독 id 가 있으면 paddle, 없으면 수동 부여
UPDATE "user_subscriptions"
  SET "provider" = CASE WHEN "provider_subscription_id" IS NOT NULL THEN 'paddle' ELSE 'manual' END::"BillingProvider",
      "billing_issue_detected_at" = CASE WHEN "status" = 'past_due' THEN "updated_at" END;
ALTER TABLE "user_subscriptions" ALTER COLUMN "provider" SET NOT NULL;
DROP INDEX "user_subscriptions_paddle_subscription_id_key";
CREATE UNIQUE INDEX "user_subscriptions_provider_provider_subscription_id_key"
  ON "user_subscriptions"("provider", "provider_subscription_id");

-- subscription_orders
ALTER TABLE "subscription_orders" RENAME COLUMN "paddle_transaction_id" TO "provider_transaction_id";
ALTER TABLE "subscription_orders"
  ADD COLUMN "provider" "BillingProvider",
  ADD COLUMN "provider_environment" "BillingEnvironment",
  ADD COLUMN "currency" VARCHAR(3),
  ADD COLUMN "period_type" "BillingPeriodType" NOT NULL DEFAULT 'normal',
  ADD COLUMN "period_start" TIMESTAMPTZ(0),
  ADD COLUMN "period_end" TIMESTAMPTZ(0),
  ADD COLUMN "refunded_at" TIMESTAMPTZ(0),
  ADD COLUMN "refunded_amount" INTEGER;
-- 기존 Paddle 가격은 KRW 단일 (적용 전 Paddle 콘솔에서 확인, 스펙 §10-0)
UPDATE "subscription_orders" SET "provider" = 'paddle', "currency" = 'KRW';
ALTER TABLE "subscription_orders" ALTER COLUMN "provider" SET NOT NULL, ALTER COLUMN "currency" SET NOT NULL;
DROP INDEX "subscription_orders_paddle_transaction_id_key";
CREATE UNIQUE INDEX "subscription_orders_provider_provider_transaction_id_key"
  ON "subscription_orders"("provider", "provider_transaction_id");

-- paddle_webhook_events → billing_webhook_events
ALTER TABLE "paddle_webhook_events" RENAME TO "billing_webhook_events";
ALTER TABLE "billing_webhook_events" ADD COLUMN "provider" "BillingProvider", ADD COLUMN "payload" JSONB;
UPDATE "billing_webhook_events" SET "provider" = 'paddle';
ALTER TABLE "billing_webhook_events" ALTER COLUMN "provider" SET NOT NULL;
ALTER TABLE "billing_webhook_events" DROP CONSTRAINT "paddle_webhook_events_pkey";
ALTER TABLE "billing_webhook_events" ADD CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("provider", "event_id");
