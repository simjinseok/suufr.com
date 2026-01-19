-- AlterTable: Add phone and email to students for CardDAV
ALTER TABLE "students" ADD COLUMN "phone" TEXT;
ALTER TABLE "students" ADD COLUMN "email" TEXT;

-- CreateTable: AppToken for CalDAV/CardDAV authentication
CREATE TABLE "app_tokens" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ(0),
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(0),
    "user_id" UUID NOT NULL,

    CONSTRAINT "app_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_tokens_uuid_key" ON "app_tokens"("uuid");

-- CreateIndex
CREATE INDEX "app_tokens_user_id_deleted_at_idx" ON "app_tokens"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "app_tokens_token_hash_deleted_at_idx" ON "app_tokens"("token_hash", "deleted_at");
