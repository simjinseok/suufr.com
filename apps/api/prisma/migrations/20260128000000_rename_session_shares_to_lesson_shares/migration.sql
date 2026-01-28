-- 테이블 이름 변경
ALTER TABLE "session_shares" RENAME TO "lesson_shares";

-- 인덱스 이름 변경
ALTER INDEX "session_shares_share_id_expires_at_deleted_at_idx"
  RENAME TO "lesson_shares_share_id_expires_at_deleted_at_idx";
ALTER INDEX "session_shares_lesson_id_deleted_at_idx"
  RENAME TO "lesson_shares_lesson_id_deleted_at_idx";
ALTER INDEX "session_shares_uuid_key"
  RENAME TO "lesson_shares_uuid_key";
ALTER INDEX "session_shares_share_id_key"
  RENAME TO "lesson_shares_share_id_key";
ALTER INDEX "session_shares_pkey"
  RENAME TO "lesson_shares_pkey";

-- FK 제약조건 이름 변경
ALTER TABLE "lesson_shares"
  RENAME CONSTRAINT "session_shares_lesson_id_fkey" TO "lesson_shares_lesson_id_fkey";
