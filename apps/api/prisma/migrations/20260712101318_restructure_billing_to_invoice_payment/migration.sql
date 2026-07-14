-- 정산 구조 개편: Lesson 중심 → Invoice(청구) + Payment(입금)
-- docs/schema-redesign.md 참조.
-- 구 payments(1:1 결제) 테이블을 invoices로 RENAME해 id/uuid를 보존하고,
-- 새 payments(입금) 테이블을 신설해 데이터를 이동한다.
-- lessons / lesson_shares / lesson_id 컬럼은 전환 검증 후 별도 마이그레이션에서 drop.

-- 1. 새 enum
CREATE TYPE "SessionType" AS ENUM ('regular', 'trial', 'comp');

-- 2. payments → invoices RENAME (기존 행 = 청구가 됨)
ALTER TABLE "payments" RENAME TO "invoices";
ALTER SEQUENCE "payments_id_seq" RENAME TO "invoices_id_seq";
ALTER TABLE "invoices" RENAME CONSTRAINT "payments_pkey" TO "invoices_pkey";
ALTER INDEX "payments_uuid_key" RENAME TO "invoices_uuid_key";
ALTER INDEX "payments_lesson_id_key" RENAME TO "invoices_lesson_id_key";
DROP INDEX "payments_paid_at_deleted_at_lesson_id_idx";

-- 3. invoices 새 컬럼 (백필 전이라 일단 nullable)
ALTER TABLE "invoices"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "price" INTEGER,
  ADD COLUMN "total_count" INTEGER,
  ADD COLUMN "period_start" DATE,
  ADD COLUMN "period_end" DATE,
  ADD COLUMN "auto_renew" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "renew_days_before" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "student_id" INTEGER;

-- 구 입금 컬럼과 lesson_id의 NOT NULL 해제 (미납 청구 INSERT·신규 청구 대비)
ALTER TABLE "invoices" ALTER COLUMN "amount" DROP NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "payment_method" DROP NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "paid_at" DROP NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "lesson_id" DROP NOT NULL;

-- lesson 관계가 optional이 되므로 FK를 SET NULL 규약으로 재생성
ALTER TABLE "invoices" DROP CONSTRAINT "payments_lesson_id_fkey";
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. 새 payments (입금 1건 = 1행, 음수 = 환불)
-- 학생 직속(잔액 모델) — 청구와 연결하지 않는다. 납부 상태는 학생 단위 Σ청구 vs Σ입금으로 파생.
CREATE TABLE "payments" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT uuidv7(),
  "amount" INTEGER NOT NULL,
  "method" TEXT NOT NULL,
  "paid_at" TIMESTAMPTZ(0) NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(0) NOT NULL,
  "deleted_at" TIMESTAMPTZ(0),
  "student_id" INTEGER NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_uuid_key" ON "payments"("uuid");
CREATE INDEX "payments_student_id_deleted_at_idx" ON "payments"("student_id", "deleted_at");
CREATE INDEX "payments_paid_at_deleted_at_idx" ON "payments"("paid_at", "deleted_at");

ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. sessions 변경: Student 직속 + 청구 귀속 + type
ALTER TABLE "sessions"
  ADD COLUMN "student_id" INTEGER,
  ADD COLUMN "invoice_id" INTEGER,
  ADD COLUMN "type" "SessionType" NOT NULL DEFAULT 'regular';

ALTER TABLE "sessions" ALTER COLUMN "lesson_id" DROP NOT NULL;

DROP INDEX "sessions_lesson_id_session_at_deleted_at_idx";

ALTER TABLE "sessions" DROP CONSTRAINT "sessions_lesson_id_fkey";
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. student_shares (학생 단위 공유, LessonShare 대체)
CREATE TABLE "student_shares" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT uuidv7(),
  "share_id" VARCHAR(10) NOT NULL,
  "show_payments" BOOLEAN NOT NULL DEFAULT true,
  "expires_at" TIMESTAMPTZ(0) NOT NULL,
  "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(0) NOT NULL,
  "deleted_at" TIMESTAMPTZ(0),
  "student_id" INTEGER NOT NULL,

  CONSTRAINT "student_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_shares_uuid_key" ON "student_shares"("uuid");
CREATE UNIQUE INDEX "student_shares_share_id_key" ON "student_shares"("share_id");
CREATE INDEX "student_shares_share_id_expires_at_deleted_at_idx" ON "student_shares"("share_id", "expires_at", "deleted_at");
CREATE INDEX "student_shares_student_id_deleted_at_idx" ON "student_shares"("student_id", "deleted_at");

ALTER TABLE "student_shares" ADD CONSTRAINT "student_shares_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. ===== 백필 =====

-- 7-1. 기존 invoices(구 payments 행)에 청구 정보 채우기
-- price=구 amount, totalCount=살아있는 세션 수 (회차제 의미 보존 — totalCount 있음 = 회차 동작),
-- 기간=귀속 세션의 첫/마지막 날짜(KST, 세션 없으면 lesson 생성일), title=구 lesson.title
UPDATE "invoices" i SET
  "student_id"  = l."student_id",
  "title"       = NULLIF(l."title", ''),
  "price"       = i."amount",
  "total_count" = COALESCE(agg.cnt, 0),
  "period_start" = COALESCE(agg.first_date, (l."created_at" AT TIME ZONE 'Asia/Seoul')::date),
  "period_end"   = COALESCE(agg.last_date, (l."created_at" AT TIME ZONE 'Asia/Seoul')::date)
FROM "lessons" l
LEFT JOIN LATERAL (
  SELECT count(*) AS cnt,
         min((s."session_at" AT TIME ZONE 'Asia/Seoul')::date) AS first_date,
         max((s."session_at" AT TIME ZONE 'Asia/Seoul')::date) AS last_date
  FROM "sessions" s
  WHERE s."lesson_id" = l."id" AND s."deleted_at" IS NULL
) agg ON true
WHERE i."lesson_id" = l."id";

-- 7-2. 입금 데이터 이동: 기존 청구의 amount/method/paidAt → 학생 직속 payments 1행
-- student_id는 7-1에서 백필된 invoices.student_id를 승계 (구 1:1 구조라 학생별 잔액은 이전 직후 0)
-- notes는 입금 메모였을 가능성이 높아 payments로도 복사 (invoices.notes는 유지 — 정보 손실 방지)
INSERT INTO "payments" ("amount", "method", "paid_at", "notes", "student_id", "created_at", "updated_at", "deleted_at")
SELECT i."amount", i."payment_method", i."paid_at", i."notes", i."student_id", i."created_at", i."updated_at", i."deleted_at"
FROM "invoices" i
WHERE i."amount" IS NOT NULL;

-- 7-3. 미납 Lesson(청구 없는 묶음) → price=0 청구 INSERT
-- "price=0 && 입금 0건"은 앱에서 "금액 미입력"으로 노출되어 수동 수정을 유도한다
INSERT INTO "invoices"
  ("title", "price", "total_count", "period_start", "period_end",
   "student_id", "lesson_id", "created_at", "updated_at", "deleted_at")
SELECT
  NULLIF(l."title", ''),
  0,
  COALESCE(agg.cnt, 0),
  COALESCE(agg.first_date, (l."created_at" AT TIME ZONE 'Asia/Seoul')::date),
  COALESCE(agg.last_date, (l."created_at" AT TIME ZONE 'Asia/Seoul')::date),
  l."student_id",
  l."id",
  l."created_at",
  l."updated_at",
  l."deleted_at"
FROM "lessons" l
LEFT JOIN LATERAL (
  SELECT count(*) AS cnt,
         min((s."session_at" AT TIME ZONE 'Asia/Seoul')::date) AS first_date,
         max((s."session_at" AT TIME ZONE 'Asia/Seoul')::date) AS last_date
  FROM "sessions" s
  WHERE s."lesson_id" = l."id" AND s."deleted_at" IS NULL
) agg ON true
WHERE NOT EXISTS (SELECT 1 FROM "invoices" i WHERE i."lesson_id" = l."id");

-- 7-4. sessions 백필: 학생 직속화 + 청구 귀속 (soft-delete 행 포함 — deletedAt 그대로 승계 원칙)
UPDATE "sessions" s SET "student_id" = l."student_id"
FROM "lessons" l WHERE s."lesson_id" = l."id";

UPDATE "sessions" s SET "invoice_id" = i."id"
FROM "invoices" i WHERE i."lesson_id" = s."lesson_id";

-- 8. NOT NULL 승격 + FK + 인덱스
ALTER TABLE "invoices" ALTER COLUMN "price" SET NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "student_id" SET NOT NULL;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "invoices_student_id_deleted_at_idx" ON "invoices"("student_id", "deleted_at");

ALTER TABLE "sessions" ALTER COLUMN "student_id" SET NOT NULL;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "sessions_student_id_session_at_deleted_at_idx" ON "sessions"("student_id", "session_at", "deleted_at");
CREATE INDEX "sessions_invoice_id_idx" ON "sessions"("invoice_id");

-- 9. 구 입금 컬럼 제거 (데이터는 7-2에서 payments로 이동 완료)
ALTER TABLE "invoices" DROP COLUMN "amount";
ALTER TABLE "invoices" DROP COLUMN "payment_method";
ALTER TABLE "invoices" DROP COLUMN "paid_at";
