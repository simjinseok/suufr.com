-- 이벤트 시각을 밀리초로 보존. TIMESTAMPTZ(0) 은 소수 초를 반올림해 같은 초 안의 늦은 이벤트가 순서 역전 가드에 걸린다
ALTER TABLE "user_subscriptions" ALTER COLUMN "provider_last_event_at" TYPE TIMESTAMPTZ(3);
ALTER TABLE "billing_webhook_events" ALTER COLUMN "occurred_at" TYPE TIMESTAMPTZ(3);
