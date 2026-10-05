-- better-auth 사용자 테이블 (Phase 1). id = 기존 Cognito sub. 백필은 scripts/cognito/backfill-users.sql 로 수행.
-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "cognito_migrated_at" TIMESTAMPTZ(0),
    "cognito_mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "requires_two_factor_setup" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
