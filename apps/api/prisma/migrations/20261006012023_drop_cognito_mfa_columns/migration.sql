-- Cognito MFA 이전용 컬럼 제거 (Cognito MFA 사용자 0명 확인). cognito_migrated_at 은 감사용으로 유지
-- AlterTable
ALTER TABLE "users" DROP COLUMN "cognito_mfa_enabled",
DROP COLUMN "requires_two_factor_setup";
