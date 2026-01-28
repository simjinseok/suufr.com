-- DropForeignKey
ALTER TABLE "feedback_media_files" DROP CONSTRAINT "feedback_media_files_feedback_id_fkey";

-- DropForeignKey
ALTER TABLE "feedback_media_files" DROP CONSTRAINT "feedback_media_files_media_file_id_fkey";

-- DropTable
DROP TABLE "feedback_media_files";
