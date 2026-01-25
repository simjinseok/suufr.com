-- CreateTable
CREATE TABLE "feedback_media_files" (
    "id" SERIAL NOT NULL,
    "feedback_id" INTEGER NOT NULL,
    "media_file_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_media_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_media_files_feedback_id_idx" ON "feedback_media_files"("feedback_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_media_files_feedback_id_media_file_id_key" ON "feedback_media_files"("feedback_id", "media_file_id");

-- AddForeignKey
ALTER TABLE "feedback_media_files" ADD CONSTRAINT "feedback_media_files_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "feedback"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_media_files" ADD CONSTRAINT "feedback_media_files_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
