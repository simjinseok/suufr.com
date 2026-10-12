-- 수강 시작일 필수화. 시작일이 없던 수강권은 귀속 세션의 첫 날짜, 없으면 생성일로 채운다.
-- 날짜는 소유자 타임존(user_settings.timezone, 없으면 UTC — resolveTimezone 과 같은 기본값) 기준.
UPDATE "invoices" i
SET "period_start" = (
  COALESCE(
    (SELECT MIN(se."session_at") FROM "sessions" se WHERE se."invoice_id" = i."id" AND se."deleted_at" IS NULL),
    i."created_at"
  ) AT TIME ZONE COALESCE(us."timezone", 'UTC')
)::date
FROM "students" s
JOIN "organizations" o ON o."id" = s."organization_id"
LEFT JOIN "user_settings" us ON us."user_id" = o."user_id"
WHERE s."id" = i."student_id" AND i."period_start" IS NULL;

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "period_start" SET NOT NULL;
