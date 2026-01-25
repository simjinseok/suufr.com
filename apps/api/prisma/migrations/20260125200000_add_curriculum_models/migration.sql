-- CreateTable
CREATE TABLE "curriculums" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT uuidv7(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,
    "deleted_at" TIMESTAMPTZ(0),
    "organization_id" INTEGER NOT NULL,

    CONSTRAINT "curriculums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_items" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT uuidv7(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,
    "deleted_at" TIMESTAMPTZ(0),
    "curriculum_id" INTEGER NOT NULL,

    CONSTRAINT "curriculum_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_item_media_files" (
    "id" SERIAL NOT NULL,
    "curriculum_item_id" INTEGER NOT NULL,
    "media_file_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_item_media_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "curriculums_uuid_key" ON "curriculums"("uuid");

-- CreateIndex
CREATE INDEX "curriculums_organization_id_deleted_at_idx" ON "curriculums"("organization_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_items_uuid_key" ON "curriculum_items"("uuid");

-- CreateIndex
CREATE INDEX "curriculum_items_curriculum_id_deleted_at_idx" ON "curriculum_items"("curriculum_id", "deleted_at");

-- CreateIndex
CREATE INDEX "curriculum_item_media_files_curriculum_item_id_idx" ON "curriculum_item_media_files"("curriculum_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_item_media_files_curriculum_item_id_media_file_id_key" ON "curriculum_item_media_files"("curriculum_item_id", "media_file_id");

-- AddForeignKey
ALTER TABLE "curriculums" ADD CONSTRAINT "curriculums_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_items" ADD CONSTRAINT "curriculum_items_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curriculums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_item_media_files" ADD CONSTRAINT "curriculum_item_media_files_curriculum_item_id_fkey" FOREIGN KEY ("curriculum_item_id") REFERENCES "curriculum_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_item_media_files" ADD CONSTRAINT "curriculum_item_media_files_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
