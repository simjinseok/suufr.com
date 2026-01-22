-- Migration: Remove OrganizationMember
-- This migration removes the OrganizationMember and MemberStatus models

-- 1. member_id 인덱스 삭제
DROP INDEX IF EXISTS "lessons_member_id_created_at_deleted_at_idx";

-- 2. member_id 외래 키 제약 조건 삭제
ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "lessons_member_id_fkey";

-- 3. member_id 컬럼 삭제
ALTER TABLE "lessons" DROP COLUMN IF EXISTS "member_id";

-- 4. member_statuses 테이블 삭제
DROP TABLE IF EXISTS "member_statuses";

-- 5. organization_members 테이블 삭제
DROP TABLE IF EXISTS "organization_members";

-- 6. MemberStatus enum 삭제
DROP TYPE IF EXISTS "MemberStatus";

-- 7. OrganizationRole enum 삭제
DROP TYPE IF EXISTS "OrganizationRole";

-- 8. user_settings에서 current_organization_id 컬럼 삭제
ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "current_organization_id";
