-- Phase 5 — TOTP 재등록 안내 대상 (Cognito MFA 사용자 중 better-auth 로 이전됐지만 아직 TOTP 를 등록하지 않은 사용자)
--
--   psql "$POSTGRES_PRISMA_URL" -At -F ',' -f scripts/mail/mfa-reenroll-targets.sql > scripts/mail/out/mfa-reenroll-targets.csv
--
SELECT email
FROM users
WHERE requires_two_factor_setup = true
  AND COALESCE(two_factor_enabled, false) = false
ORDER BY email;
