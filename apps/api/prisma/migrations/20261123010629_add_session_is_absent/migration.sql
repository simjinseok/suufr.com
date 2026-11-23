ALTER TABLE "sessions" ADD COLUMN "is_absent" BOOLEAN NOT NULL DEFAULT false;

-- Prisma 스키마로는 CHECK를 적을 수 없어 SQL에만 둔다
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_absent_requires_done" CHECK (NOT "is_absent" OR "is_done");
