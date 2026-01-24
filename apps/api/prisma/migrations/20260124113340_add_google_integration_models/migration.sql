-- CreateTable
CREATE TABLE "external_service_tokens" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT uuidv7(),
    "provider" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMPTZ(0),
    "scope" TEXT,
    "provider_user_id" TEXT,
    "provider_email" TEXT,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,
    "deleted_at" TIMESTAMPTZ(0),
    "user_id" UUID NOT NULL,

    CONSTRAINT "external_service_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_sync_tokens" (
    "id" SERIAL NOT NULL,
    "calendar_sync_token" TEXT,
    "calendar_id" TEXT,
    "contacts_sync_token" TEXT,
    "last_calendar_sync_at" TIMESTAMPTZ(0),
    "last_contacts_sync_at" TIMESTAMPTZ(0),
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "google_sync_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_google_events" (
    "id" SERIAL NOT NULL,
    "google_event_id" TEXT NOT NULL,
    "google_calendar_id" TEXT NOT NULL,
    "etag" TEXT,
    "last_synced_at" TIMESTAMPTZ(0),
    "sync_status" TEXT NOT NULL DEFAULT 'synced',
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,
    "session_id" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "session_google_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_google_contacts" (
    "id" SERIAL NOT NULL,
    "google_resource_name" TEXT NOT NULL,
    "etag" TEXT,
    "last_synced_at" TIMESTAMPTZ(0),
    "sync_status" TEXT NOT NULL DEFAULT 'synced',
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,
    "student_id" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "student_google_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_service_tokens_uuid_key" ON "external_service_tokens"("uuid");

-- CreateIndex
CREATE INDEX "external_service_tokens_provider_deleted_at_idx" ON "external_service_tokens"("provider", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "external_service_tokens_user_id_provider_key" ON "external_service_tokens"("user_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "google_sync_tokens_user_id_key" ON "google_sync_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_google_events_session_id_key" ON "session_google_events"("session_id");

-- CreateIndex
CREATE INDEX "session_google_events_google_event_id_idx" ON "session_google_events"("google_event_id");

-- CreateIndex
CREATE INDEX "session_google_events_user_id_sync_status_idx" ON "session_google_events"("user_id", "sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "student_google_contacts_student_id_key" ON "student_google_contacts"("student_id");

-- CreateIndex
CREATE INDEX "student_google_contacts_google_resource_name_idx" ON "student_google_contacts"("google_resource_name");

-- CreateIndex
CREATE INDEX "student_google_contacts_user_id_sync_status_idx" ON "student_google_contacts"("user_id", "sync_status");

-- AddForeignKey
ALTER TABLE "session_google_events" ADD CONSTRAINT "session_google_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_google_contacts" ADD CONSTRAINT "student_google_contacts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
