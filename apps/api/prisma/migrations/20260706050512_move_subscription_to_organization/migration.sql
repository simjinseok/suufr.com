-- 구독 주체를 사용자에서 조직으로 변경 (아직 배포 전 기능이라 데이터 이관 없음)

-- DropTable
DROP TABLE "user_subscriptions";

-- CreateTable
CREATE TABLE "organization_subscriptions" (
    "organization_id" INTEGER NOT NULL,
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

    CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("organization_id")
);

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable (로컬 외 환경에는 데이터 없음)
ALTER TABLE "subscription_orders" ADD COLUMN "organization_id" INTEGER NOT NULL;

-- DropIndex
DROP INDEX "subscription_orders_user_id_created_at_idx";

-- CreateIndex
CREATE INDEX "subscription_orders_organization_id_created_at_idx" ON "subscription_orders"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "subscription_orders_user_id_created_at_idx" ON "subscription_orders"("user_id", "created_at");
