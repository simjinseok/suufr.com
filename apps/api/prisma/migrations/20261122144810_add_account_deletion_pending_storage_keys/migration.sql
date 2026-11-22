-- AlterTable
ALTER TABLE "account_deletions" ADD COLUMN     "pending_storage_keys" TEXT[] DEFAULT ARRAY[]::TEXT[];
