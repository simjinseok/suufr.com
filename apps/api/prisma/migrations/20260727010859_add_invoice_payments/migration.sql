-- 수강권 ↔ 입금 연결 (§6-22). 순수 연결만 — 금액 배분/파생 로직 없음.
-- 연결된 미삭제 입금이 1건이라도 있으면 "입금 확인", 없으면 미납 표시.

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_payments_payment_id_idx" ON "invoice_payments"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_payments_invoice_id_payment_id_key" ON "invoice_payments"("invoice_id", "payment_id");

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
