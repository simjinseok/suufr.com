-- 새 입금 폼의 초기 결제수단. 기존 사용자는 지금까지의 하드코딩 기본값(transfer)을 그대로 이어받는다.
ALTER TABLE "user_settings" ADD COLUMN "default_payment_method" TEXT NOT NULL DEFAULT 'transfer';
