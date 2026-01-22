-- AddColumn
ALTER TABLE "organizations" ADD COLUMN "profile_name" TEXT;
ALTER TABLE "organizations" ADD COLUMN "profile_image_key" TEXT;

-- MigrateData: owner member의 데이터를 organization으로 복사
UPDATE "organizations" o
SET
  "user_id" = m."user_id",
  "profile_name" = m."name",
  "profile_image_key" = m."profile_image_key"
FROM "organization_members" m
WHERE m."organization_id" = o."id"
  AND m."role" = 'owner'
  AND m."deleted_at" IS NULL;

-- AlterColumn: user_id를 필수로 변경
ALTER TABLE "organizations" ALTER COLUMN "user_id" SET NOT NULL;
