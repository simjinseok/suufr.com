-- AlterTable
ALTER TABLE "curriculum_items" ADD COLUMN     "section_id" INTEGER,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "curriculum_sections" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT uuidv7(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL,
    "deleted_at" TIMESTAMPTZ(0),
    "curriculum_id" INTEGER NOT NULL,

    CONSTRAINT "curriculum_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_sections_uuid_key" ON "curriculum_sections"("uuid");

-- CreateIndex
CREATE INDEX "curriculum_sections_curriculum_id_deleted_at_sort_order_idx" ON "curriculum_sections"("curriculum_id", "deleted_at", "sort_order");

-- CreateIndex
CREATE INDEX "curriculum_items_curriculum_id_section_id_deleted_at_sort_o_idx" ON "curriculum_items"("curriculum_id", "section_id", "deleted_at", "sort_order");

-- AddForeignKey
ALTER TABLE "curriculum_items" ADD CONSTRAINT "curriculum_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "curriculum_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_sections" ADD CONSTRAINT "curriculum_sections_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curriculums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- 기존 항목의 순서 백필: 커리큘럼별로 created_at, id 순 → 0부터. 기존 항목은 모두 섹션 없음(section_id NULL) 묶음.
UPDATE "curriculum_items" AS ci
SET "sort_order" = s.rn
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "curriculum_id" ORDER BY "created_at", "id") - 1 AS rn
  FROM "curriculum_items"
) AS s
WHERE ci."id" = s."id";
