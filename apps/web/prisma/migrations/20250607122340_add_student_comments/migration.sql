-- CreateTable
CREATE TABLE "student_comments" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,
    "deleted_at" TIMESTAMPTZ(0),
    "student_id" INTEGER NOT NULL,

    CONSTRAINT "student_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_comments_student_id_created_at_deleted_at_idx" ON "student_comments"("student_id", "created_at", "deleted_at");

-- AddForeignKey
ALTER TABLE "student_comments" ADD CONSTRAINT "student_comments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
