-- AlterTable
ALTER TABLE "google_sync_tokens" ADD COLUMN "webhook_channel_id" TEXT,
ADD COLUMN "webhook_resource_id" TEXT,
ADD COLUMN "webhook_expiration" TIMESTAMPTZ(0);
