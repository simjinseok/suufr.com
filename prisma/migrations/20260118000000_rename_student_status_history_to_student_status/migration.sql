-- Rename index
ALTER INDEX "student_status_histories_student_id_changed_at_deleted_at_idx"
RENAME TO "student_statuses_student_id_changed_at_deleted_at_idx";

-- Rename table
ALTER TABLE "student_status_histories" RENAME TO "student_statuses";

-- Rename FK constraint
ALTER TABLE "student_statuses"
RENAME CONSTRAINT "student_status_histories_student_id_fkey"
TO "student_statuses_student_id_fkey";
