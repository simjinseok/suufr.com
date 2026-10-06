-- Cognito 이전 감사용 컬럼 제거 (읽는 코드 없음)
ALTER TABLE "users" DROP COLUMN "cognito_migrated_at";
