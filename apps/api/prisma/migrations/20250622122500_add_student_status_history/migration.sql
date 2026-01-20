-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('pending', 'active', 'paused', 'leave');

-- Update existing data to map 'dropped' to 'leave'
UPDATE "students" SET "status" = 'leave' WHERE "status" = 'dropped';

-- AlterTable
ALTER TABLE "students" ALTER COLUMN "status" TYPE "StudentStatus" USING "status"::"StudentStatus",
ALTER COLUMN "status" SET DEFAULT 'pending';

-- CreateTable
CREATE TABLE "student_status_histories" (
    "id" SERIAL NOT NULL,
    "status" "StudentStatus" NOT NULL,
    "notes" TEXT,
    "changed_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,
    "deleted_at" TIMESTAMPTZ(0),
    "student_id" INTEGER NOT NULL,

    CONSTRAINT "student_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_status_histories_student_id_changed_at_deleted_at_idx" ON "student_status_histories"("student_id", "changed_at", "deleted_at");

-- AddForeignKey
ALTER TABLE "student_status_histories" ADD CONSTRAINT "student_status_histories_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;