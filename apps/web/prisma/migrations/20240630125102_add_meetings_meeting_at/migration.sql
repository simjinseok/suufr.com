/*
  Warnings:

  - Added the required column `meeting_at` to the `meetings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "meeting_at" TIMESTAMPTZ(0) NOT NULL;
