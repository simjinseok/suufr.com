-- DropForeignKey
ALTER TABLE "lesson_media_files" DROP CONSTRAINT "lesson_media_files_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_media_files" DROP CONSTRAINT "lesson_media_files_media_file_id_fkey";

-- DropTable
DROP TABLE "lesson_media_files";

-- CreateTable
CREATE TABLE "session_media_files" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "media_file_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_media_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_media_files_session_id_idx" ON "session_media_files"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_media_files_session_id_media_file_id_key" ON "session_media_files"("session_id", "media_file_id");

-- AddForeignKey
ALTER TABLE "session_media_files" ADD CONSTRAINT "session_media_files_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_media_files" ADD CONSTRAINT "session_media_files_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
