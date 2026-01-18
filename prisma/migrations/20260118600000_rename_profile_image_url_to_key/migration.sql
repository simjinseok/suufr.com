-- Rename profile_image_url to profile_image_key (students only)
-- organization_members already has profile_image_key from initial migration
ALTER TABLE "students" RENAME COLUMN "profile_image_url" TO "profile_image_key";
