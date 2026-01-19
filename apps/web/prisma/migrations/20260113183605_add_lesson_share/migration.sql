-- CreateTable
CREATE TABLE "lesson_shares" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "syllabus_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(0) NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,
    "deleted_at" TIMESTAMPTZ(0),

    CONSTRAINT "lesson_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lesson_shares_uuid_key" ON "lesson_shares"("uuid");

-- CreateIndex
CREATE INDEX "lesson_shares_uuid_expires_at_deleted_at_idx" ON "lesson_shares"("uuid", "expires_at", "deleted_at");

-- CreateIndex
CREATE INDEX "lesson_shares_syllabus_id_deleted_at_idx" ON "lesson_shares"("syllabus_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "lesson_shares" ADD CONSTRAINT "lesson_shares_syllabus_id_fkey" FOREIGN KEY ("syllabus_id") REFERENCES "syllabuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
