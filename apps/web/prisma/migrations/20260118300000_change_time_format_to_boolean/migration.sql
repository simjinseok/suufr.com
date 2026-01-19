-- Change time_format from String to Boolean
-- Existing '24h' users -> true, '12h' users -> false
-- New users default to false (12-hour format)

-- Add new boolean column
ALTER TABLE "user_settings" ADD COLUMN "use_24_hour_format" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing data
UPDATE "user_settings" SET "use_24_hour_format" = (time_format = '24h');

-- Drop old column
ALTER TABLE "user_settings" DROP COLUMN "time_format";
