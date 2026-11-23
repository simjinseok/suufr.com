-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('scheduled', 'done', 'absent');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "status" "SessionStatus" NOT NULL DEFAULT 'scheduled';

-- 완료 여부를 상태로 옮긴 뒤 옛 컬럼을 없앤다
UPDATE "sessions" SET "status" = 'done' WHERE "is_done";

ALTER TABLE "sessions" DROP COLUMN "is_done";
