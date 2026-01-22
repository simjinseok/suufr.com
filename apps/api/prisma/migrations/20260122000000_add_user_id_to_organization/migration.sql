-- AddColumn
ALTER TABLE "organizations" ADD COLUMN "user_id" UUID;

-- CreateIndex
CREATE INDEX "organizations_user_id_deleted_at_idx" ON "organizations"("user_id", "deleted_at");
