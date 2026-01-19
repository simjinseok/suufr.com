-- AlterTable: Student에 organizationId 추가
ALTER TABLE "students" ADD COLUMN "organization_id" INT;

-- 기존 데이터 마이그레이션: userId로 OrganizationMember를 찾아 organization_id 설정
UPDATE "students" s
SET "organization_id" = (
  SELECT om."organization_id"
  FROM "organization_members" om
  WHERE om."user_id" = s."user_id"
  AND om."deleted_at" IS NULL
  LIMIT 1
);

-- NOT NULL 제약조건 추가
ALTER TABLE "students" ALTER COLUMN "organization_id" SET NOT NULL;

-- 외래키 추가
ALTER TABLE "students" ADD CONSTRAINT "students_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 기존 인덱스 삭제 및 새 인덱스 생성
DROP INDEX IF EXISTS "students_user_id_name_status_deleted_at_idx";
CREATE INDEX "students_organization_id_name_status_deleted_at_idx" ON "students"("organization_id", "name", "status", "deleted_at");


-- AlterTable: Meeting에 organizationId 추가
ALTER TABLE "meetings" ADD COLUMN "organization_id" INT;

-- 기존 데이터 마이그레이션: userId로 OrganizationMember를 찾아 organization_id 설정
UPDATE "meetings" m
SET "organization_id" = (
  SELECT om."organization_id"
  FROM "organization_members" om
  WHERE om."user_id" = m."user_id"
  AND om."deleted_at" IS NULL
  LIMIT 1
);

-- NOT NULL 제약조건 추가
ALTER TABLE "meetings" ALTER COLUMN "organization_id" SET NOT NULL;

-- 외래키 추가
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 기존 인덱스 삭제 및 새 인덱스 생성
DROP INDEX IF EXISTS "meetings_user_id_name_is_done_deleted_at_idx";
CREATE INDEX "meetings_organization_id_name_is_done_deleted_at_idx" ON "meetings"("organization_id", "name", "is_done", "deleted_at");


-- AlterTable: Lesson에 memberId 추가
ALTER TABLE "lessons" ADD COLUMN "member_id" INT;

-- 기존 데이터 마이그레이션: Student의 userId로 OrganizationMember를 찾아 member_id 설정
UPDATE "lessons" l
SET "member_id" = (
  SELECT om."id"
  FROM "organization_members" om
  JOIN "students" s ON s."user_id" = om."user_id"
  WHERE s."id" = l."student_id"
  AND om."deleted_at" IS NULL
  LIMIT 1
);

-- NOT NULL 제약조건 추가
ALTER TABLE "lessons" ALTER COLUMN "member_id" SET NOT NULL;

-- 외래키 추가
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_member_id_fkey"
  FOREIGN KEY ("member_id") REFERENCES "organization_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 인덱스 추가
CREATE INDEX "lessons_member_id_created_at_deleted_at_idx" ON "lessons"("member_id", "created_at", "deleted_at");
