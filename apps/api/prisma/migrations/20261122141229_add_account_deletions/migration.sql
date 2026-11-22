-- CreateTable
CREATE TABLE "account_deletions" (
    "user_id" UUID NOT NULL,
    "email_hmac" TEXT NOT NULL,
    "deleted_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storage_purged_at" TIMESTAMPTZ(0),

    CONSTRAINT "account_deletions_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "account_deletions_deleted_at_idx" ON "account_deletions"("deleted_at");

