-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'pro');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'canceled', 'past_due', 'expired');

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "user_id" UUID NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "current_period_start" TIMESTAMPTZ(0),
    "current_period_end" TIMESTAMPTZ(0),
    "canceled_at" TIMESTAMPTZ(0),
    "billing_key" TEXT,
    "card_company" TEXT,
    "card_number_masked" TEXT,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("user_id")
);
