-- CreateTable
CREATE TABLE "media_files" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT uuidv7(),
    "url" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "file_name" TEXT,
    "file_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_media_files" (
    "id" SERIAL NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "media_file_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_storage_quotas" (
    "user_id" UUID NOT NULL,
    "used_bytes" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,

    CONSTRAINT "user_storage_quotas_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_files_uuid_key" ON "media_files"("uuid");

-- CreateIndex
CREATE INDEX "media_files_user_id_idx" ON "media_files"("user_id");

-- CreateIndex
CREATE INDEX "media_files_user_id_file_name_idx" ON "media_files"("user_id", "file_name");

-- CreateIndex
CREATE INDEX "lesson_media_files_lesson_id_idx" ON "lesson_media_files"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_media_files_lesson_id_media_file_id_key" ON "lesson_media_files"("lesson_id", "media_file_id");

-- AddForeignKey
ALTER TABLE "lesson_media_files" ADD CONSTRAINT "lesson_media_files_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_media_files" ADD CONSTRAINT "lesson_media_files_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
