-- Phase 0 — Cognito export ↔ DB 대조 (읽기 전용)
--
-- 실행 (apps/api 에서, summarize-export.mts 로 cognito-subs.csv 를 만든 뒤):
--   psql "$POSTGRES_PRISMA_URL" -v csv=scripts/cognito/out/cognito-subs.csv -f scripts/cognito/db-crosscheck.sql
--
-- 운영 DB를 변경하지 않는다. 임시 테이블만 쓰고 세션 종료 시 사라진다.

\set ON_ERROR_STOP on

CREATE TEMP TABLE cognito_export (
  sub         uuid PRIMARY KEY,
  email       text,
  status      text,
  mfa_enabled boolean
);
\copy cognito_export FROM :'csv' WITH (FORMAT csv, HEADER true)

\echo '== 1. export 인원'
SELECT count(*) AS exported_users FROM cognito_export;

\echo '== 2. DB 에 데이터가 있는 소유자(user_id) 집합 — 테이블별 DISTINCT'
SELECT 'organizations' AS tbl, count(DISTINCT user_id) FROM organizations
UNION ALL SELECT 'user_settings',          count(DISTINCT user_id) FROM user_settings
UNION ALL SELECT 'user_subscriptions',     count(DISTINCT user_id) FROM user_subscriptions
UNION ALL SELECT 'user_storage_quotas',    count(DISTINCT user_id) FROM user_storage_quotas
UNION ALL SELECT 'app_tokens',             count(DISTINCT user_id) FROM app_tokens
UNION ALL SELECT 'external_service_tokens',count(DISTINCT user_id) FROM external_service_tokens
UNION ALL SELECT 'google_sync_tokens',     count(DISTINCT user_id) FROM google_sync_tokens
UNION ALL SELECT 'media_files',            count(DISTINCT user_id) FROM media_files
UNION ALL SELECT 'folders',                count(DISTINCT user_id) FROM folders
UNION ALL SELECT 'user_consents',          count(DISTINCT user_id) FROM user_consents;

\echo '== 3. DB 에는 있는데 Cognito 에 없는 user_id (삭제된 사용자의 잔존 데이터 → users 플레이스홀더 여부 결정, 열린 질문 10)'
WITH owners AS (
  SELECT user_id FROM organizations
  UNION SELECT user_id FROM user_settings
  UNION SELECT user_id FROM user_subscriptions
  UNION SELECT user_id FROM user_storage_quotas
  UNION SELECT user_id FROM app_tokens
  UNION SELECT user_id FROM external_service_tokens
  UNION SELECT user_id FROM google_sync_tokens
  UNION SELECT user_id FROM media_files
  UNION SELECT user_id FROM folders
  UNION SELECT user_id FROM user_consents
)
SELECT o.user_id,
       EXISTS (SELECT 1 FROM organizations g WHERE g.user_id = o.user_id AND g.deleted_at IS NULL) AS has_live_org,
       (SELECT count(*) FROM students s JOIN organizations g ON g.id = s.organization_id WHERE g.user_id = o.user_id) AS students
FROM owners o
LEFT JOIN cognito_export c ON c.sub = o.user_id
WHERE c.sub IS NULL
ORDER BY students DESC;

\echo '== 4. Cognito 에는 있는데 Organization 이 없는 사용자 (가입 후 미로그인 — 백필 시 users 행만 생기고 조직은 첫 로그인에 생성됨)'
SELECT c.status, count(*) 
FROM cognito_export c
LEFT JOIN organizations g ON g.user_id = c.sub
WHERE g.id IS NULL
GROUP BY c.status ORDER BY 2 DESC;

\echo '== 5. MFA 사용자 중 실제 활동 데이터가 있는 사람 (Phase 5 재등록 안내 대상)'
SELECT count(*) AS mfa_users_with_org
FROM cognito_export c
JOIN organizations g ON g.user_id = c.sub AND g.deleted_at IS NULL
WHERE c.mfa_enabled;

\echo '== 6. 약관 동의 이력 커버리지 (#22 이후 가입자만 있음이 정상)'
SELECT (SELECT count(DISTINCT user_id) FROM user_consents) AS users_with_consent,
       (SELECT count(*) FROM cognito_export) AS exported_users;

\echo '== 7. 기존 테이블 이름 충돌 확인 (better-auth 가 쓸 이름이 비어 있어야 함)'
SELECT tablename FROM pg_tables
WHERE schemaname = current_schema()
  AND tablename IN ('users', 'auth_sessions', 'accounts', 'verifications', 'jwks', 'two_factors');

\echo '== 8. uuid 함수 가용성 (users.id 생성은 better-auth 가 하지만 기존 관례 확인)'
SELECT proname FROM pg_proc WHERE proname IN ('uuidv7', 'gen_random_uuid');
