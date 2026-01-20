-- 기존 데이터 삭제 (UUID가 10자보다 길어서 변환 불가)
DELETE FROM "lesson_shares";

-- uuid 컬럼을 varchar(10)으로 변경하고 이름 변경
ALTER TABLE "lesson_shares"
  ALTER COLUMN "uuid" TYPE VARCHAR(10),
  ALTER COLUMN "uuid" DROP DEFAULT;

ALTER TABLE "lesson_shares"
  RENAME COLUMN "uuid" TO "share_id";
