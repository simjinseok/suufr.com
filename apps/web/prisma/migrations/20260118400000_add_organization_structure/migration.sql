-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('owner', 'teacher');

-- CreateEnum: MemberStatusValue
CREATE TYPE "MemberStatus" AS ENUM ('active', 'paused', 'leave');

-- CreateTable
CREATE TABLE "organizations" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,
    "deleted_at" TIMESTAMPTZ(0),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'teacher',
    "status" "MemberStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,
    "deleted_at" TIMESTAMPTZ(0),
    "organization_id" INTEGER NOT NULL,
    "user_id" UUID,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable: member_statuses
CREATE TABLE "member_statuses" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT uuidv7(),
    "status" "MemberStatus" NOT NULL,
    "notes" TEXT,
    "changed_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,
    "deleted_at" TIMESTAMPTZ(0),
    "member_id" INTEGER NOT NULL,

    CONSTRAINT "member_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_uuid_key" ON "organizations"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_uuid_key" ON "organization_members"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_user_id_key" ON "organization_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_name_key" ON "organization_members"("organization_id", "name");

-- CreateIndex
CREATE INDEX "organization_members_organization_id_role_deleted_at_idx" ON "organization_members"("organization_id", "role", "deleted_at");

-- AddColumn
ALTER TABLE "user_settings" ADD COLUMN "current_organization_id" INTEGER;

-- CreateIndex: member_statuses
CREATE UNIQUE INDEX "member_statuses_uuid_key" ON "member_statuses"("uuid");
CREATE INDEX "member_statuses_member_id_changed_at_deleted_at_idx" ON "member_statuses"("member_id", "changed_at", "deleted_at");

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: member_statuses
ALTER TABLE "member_statuses" ADD CONSTRAINT "member_statuses_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "organization_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
