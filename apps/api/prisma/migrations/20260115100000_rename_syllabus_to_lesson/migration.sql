-- Rename syllabuses table to lessons
-- Safe migration: preserves all data

-- Step 1: Drop FK constraints
ALTER TABLE "payments" DROP CONSTRAINT "payments_syllabus_id_fkey";
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_syllabus_id_fkey";
ALTER TABLE "session_shares" DROP CONSTRAINT "session_shares_syllabus_id_fkey";

-- Step 2: Drop indexes
DROP INDEX "syllabuses_student_id_created_at_deleted_at_idx";
DROP INDEX "payments_paid_at_deleted_at_syllabus_id_idx";
DROP INDEX "payments_syllabus_id_key";
DROP INDEX "sessions_syllabus_id_session_at_deleted_at_idx";
DROP INDEX "session_shares_syllabus_id_deleted_at_idx";

-- Step 3: Rename columns
ALTER TABLE "payments" RENAME COLUMN "syllabus_id" TO "lesson_id";
ALTER TABLE "sessions" RENAME COLUMN "syllabus_id" TO "lesson_id";
ALTER TABLE "session_shares" RENAME COLUMN "syllabus_id" TO "lesson_id";

-- Step 4: Rename table
ALTER TABLE "syllabuses" RENAME TO "lessons";

-- Step 5: Rename primary key constraint
ALTER TABLE "lessons" RENAME CONSTRAINT "syllabuses_pkey" TO "lessons_pkey";

-- Step 6: Recreate indexes with new names
CREATE INDEX "lessons_student_id_created_at_deleted_at_idx" ON "lessons"("student_id", "created_at", "deleted_at");
CREATE INDEX "payments_paid_at_deleted_at_lesson_id_idx" ON "payments"("paid_at", "deleted_at", "lesson_id");
CREATE UNIQUE INDEX "payments_lesson_id_key" ON "payments"("lesson_id");
CREATE INDEX "sessions_lesson_id_session_at_deleted_at_idx" ON "sessions"("lesson_id", "session_at", "deleted_at");
CREATE INDEX "session_shares_lesson_id_deleted_at_idx" ON "session_shares"("lesson_id", "deleted_at");

-- Step 7: Recreate FK constraints with new names
ALTER TABLE "payments" ADD CONSTRAINT "payments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_shares" ADD CONSTRAINT "session_shares_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
