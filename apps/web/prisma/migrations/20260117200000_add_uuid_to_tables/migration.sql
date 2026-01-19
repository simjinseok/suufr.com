-- 1. uuid 컬럼 추가 (PostgreSQL 18 uuidv7() 사용)
ALTER TABLE "students" ADD COLUMN "uuid" UUID NOT NULL DEFAULT uuidv7();
ALTER TABLE "lessons" ADD COLUMN "uuid" UUID NOT NULL DEFAULT uuidv7();
ALTER TABLE "sessions" ADD COLUMN "uuid" UUID NOT NULL DEFAULT uuidv7();
ALTER TABLE "payments" ADD COLUMN "uuid" UUID NOT NULL DEFAULT uuidv7();
ALTER TABLE "meetings" ADD COLUMN "uuid" UUID NOT NULL DEFAULT uuidv7();
ALTER TABLE "feedback" ADD COLUMN "uuid" UUID NOT NULL DEFAULT uuidv7();
ALTER TABLE "student_comments" ADD COLUMN "uuid" UUID NOT NULL DEFAULT uuidv7();
ALTER TABLE "student_status_histories" ADD COLUMN "uuid" UUID NOT NULL DEFAULT uuidv7();
ALTER TABLE "session_shares" ADD COLUMN "uuid" UUID NOT NULL DEFAULT uuidv7();

-- 2. 유니크 인덱스 추가
CREATE UNIQUE INDEX "students_uuid_key" ON "students"("uuid");
CREATE UNIQUE INDEX "lessons_uuid_key" ON "lessons"("uuid");
CREATE UNIQUE INDEX "sessions_uuid_key" ON "sessions"("uuid");
CREATE UNIQUE INDEX "payments_uuid_key" ON "payments"("uuid");
CREATE UNIQUE INDEX "meetings_uuid_key" ON "meetings"("uuid");
CREATE UNIQUE INDEX "feedback_uuid_key" ON "feedback"("uuid");
CREATE UNIQUE INDEX "student_comments_uuid_key" ON "student_comments"("uuid");
CREATE UNIQUE INDEX "student_status_histories_uuid_key" ON "student_status_histories"("uuid");
CREATE UNIQUE INDEX "session_shares_uuid_key" ON "session_shares"("uuid");
