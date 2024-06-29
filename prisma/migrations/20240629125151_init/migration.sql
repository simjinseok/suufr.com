-- CreateTable
CREATE TABLE "students" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "user_id" UUID NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syllabuses" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "student_id" INTEGER NOT NULL,

    CONSTRAINT "syllabuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" SERIAL NOT NULL,
    "notes" TEXT NOT NULL,
    "lesson_at" TIMESTAMP(3) NOT NULL,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "syllabus_id" INTEGER NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" SERIAL NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "lesson_id" INTEGER NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_method" TEXT NOT NULL,
    "notes" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "syllabus_id" INTEGER NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "students_user_id_name_status_deleted_at_idx" ON "students"("user_id", "name", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "syllabuses_student_id_deleted_at_idx" ON "syllabuses"("student_id", "deleted_at");

-- CreateIndex
CREATE INDEX "lessons_syllabus_id_lesson_at_deleted_at_idx" ON "lessons"("syllabus_id", "lesson_at", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_lesson_id_key" ON "feedback"("lesson_id");

-- CreateIndex
CREATE INDEX "feedback_lesson_id_deleted_at_idx" ON "feedback"("lesson_id", "deleted_at");

-- CreateIndex
CREATE INDEX "payments_paid_at_deleted_at_syllabus_id_idx" ON "payments"("paid_at", "deleted_at", "syllabus_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_syllabus_id_key" ON "payments"("syllabus_id");

-- CreateIndex
CREATE INDEX "meetings_user_id_name_deleted_at_idx" ON "meetings"("user_id", "name", "deleted_at");

-- AddForeignKey
ALTER TABLE "syllabuses" ADD CONSTRAINT "syllabuses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_syllabus_id_fkey" FOREIGN KEY ("syllabus_id") REFERENCES "syllabuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_syllabus_id_fkey" FOREIGN KEY ("syllabus_id") REFERENCES "syllabuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
