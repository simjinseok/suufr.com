-- CreateEnum
CREATE TYPE "SubscriptionOrderStatus" AS ENUM ('done', 'failed');

-- CreateTable
CREATE TABLE "subscription_orders" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" TEXT NOT NULL,
    "payment_key" TEXT,
    "amount" INTEGER NOT NULL,
    "status" "SubscriptionOrderStatus" NOT NULL,
    "fail_reason" TEXT,
    "approved_at" TIMESTAMPTZ(0),
    "receipt_url" TEXT,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_orders_order_id_key" ON "subscription_orders"("order_id");

-- CreateIndex
CREATE INDEX "subscription_orders_user_id_created_at_idx" ON "subscription_orders"("user_id", "created_at");
