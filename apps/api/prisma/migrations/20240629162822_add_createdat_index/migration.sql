-- DropIndex
DROP INDEX "syllabuses_student_id_deleted_at_idx";

-- CreateIndex
CREATE INDEX "syllabuses_student_id_created_at_deleted_at_idx" ON "syllabuses"("student_id", "created_at", "deleted_at");
