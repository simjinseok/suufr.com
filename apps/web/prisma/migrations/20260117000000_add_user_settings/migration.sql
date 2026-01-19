-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" UUID NOT NULL,
    "time_format" TEXT NOT NULL DEFAULT '24h',
    "default_duration" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);
