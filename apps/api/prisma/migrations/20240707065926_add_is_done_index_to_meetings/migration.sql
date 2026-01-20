-- DropIndex
DROP INDEX "meetings_user_id_name_deleted_at_idx";

-- CreateIndex
CREATE INDEX "meetings_user_id_name_is_done_deleted_at_idx" ON "meetings"("user_id", "name", "is_done", "deleted_at");
