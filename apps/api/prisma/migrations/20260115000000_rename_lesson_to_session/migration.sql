-- Rename lessons table to sessions
-- Safe migration: preserves all data

-- Step 1: Drop FK constraints
ALTER TABLE "feedback" DROP CONSTRAINT "feedback_lesson_id_fkey";
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_syllabus_id_fkey";
ALTER TABLE "lesson_shares" DROP CONSTRAINT "lesson_shares_syllabus_id_fkey";

-- Step 2: Drop indexes
DROP INDEX "lessons_syllabus_id_lesson_at_deleted_at_idx";
DROP INDEX "feedback_lesson_id_key";
DROP INDEX "feedback_lesson_id_deleted_at_idx";
DROP INDEX "lesson_shares_uuid_key";
DROP INDEX "lesson_shares_uuid_expires_at_deleted_at_idx";
DROP INDEX "lesson_shares_syllabus_id_deleted_at_idx";

-- Step 3: Rename columns
ALTER TABLE "lessons" RENAME COLUMN "lesson_at" TO "session_at";
ALTER TABLE "feedback" RENAME COLUMN "lesson_id" TO "session_id";

-- Step 4: Rename tables
ALTER TABLE "lessons" RENAME TO "sessions";
ALTER TABLE "lesson_shares" RENAME TO "session_shares";

-- Step 5: Rename primary key constraints
ALTER TABLE "sessions" RENAME CONSTRAINT "lessons_pkey" TO "sessions_pkey";
ALTER TABLE "session_shares" RENAME CONSTRAINT "lesson_shares_pkey" TO "session_shares_pkey";

-- Step 6: Recreate indexes with new names
CREATE INDEX "sessions_syllabus_id_session_at_deleted_at_idx" ON "sessions"("syllabus_id", "session_at", "deleted_at");
CREATE UNIQUE INDEX "feedback_session_id_key" ON "feedback"("session_id");
CREATE INDEX "feedback_session_id_deleted_at_idx" ON "feedback"("session_id", "deleted_at");
CREATE UNIQUE INDEX "session_shares_share_id_key" ON "session_shares"("share_id");
CREATE INDEX "session_shares_share_id_expires_at_deleted_at_idx" ON "session_shares"("share_id", "expires_at", "deleted_at");
CREATE INDEX "session_shares_syllabus_id_deleted_at_idx" ON "session_shares"("syllabus_id", "deleted_at");

-- Step 7: Recreate FK constraints with new names
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_syllabus_id_fkey" FOREIGN KEY ("syllabus_id") REFERENCES "syllabuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_shares" ADD CONSTRAINT "session_shares_syllabus_id_fkey" FOREIGN KEY ("syllabus_id") REFERENCES "syllabuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
