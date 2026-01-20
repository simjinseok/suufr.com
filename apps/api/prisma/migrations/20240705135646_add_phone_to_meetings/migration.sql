-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "is_done" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT;
