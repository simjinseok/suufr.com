-- Phase 1 — Cognito export → users 테이블 백필 (멱등, 재실행 안전)
--
-- 실행 (apps/api 에서, summarize-export.mts 로 cognito-subs.csv 를 만든 뒤):
--   psql "$POSTGRES_PRISMA_URL" -v csv=scripts/cognito/out/cognito-subs.csv -f scripts/cognito/backfill-users.sql
--
-- 규칙
--   - id = Cognito sub. 이미 있는 행은 cognito_mfa_enabled 만 갱신한다 (이름·이메일은 사용자가 바꿨을 수 있으므로 덮어쓰지 않음).
--   - email 은 export 단계에서 소문자 정규화됨. 소문자 기준 중복이 있으면 UNIQUE 위반으로 전체가 롤백된다 → Phase 0 에서 먼저 정리.
--   - email_verified = Cognito email_verified && CONFIRMED. UNCONFIRMED 사용자는 false 로 들어가며 가입 완료(OTP 인증) 전까지 로그인 불가.
--   - name 이 없으면 이메일 로컬파트. 이메일도 없으면(비정상) 건너뛴다.
--   - 비밀번호(accounts)는 만들지 않는다 — 첫 로그인의 lazy migration 이 채운다.

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE cognito_export (
  sub            uuid PRIMARY KEY,
  email          text,
  name           text,
  email_verified boolean,
  status         text,
  mfa_enabled    boolean
) ON COMMIT DROP;
\copy cognito_export FROM :'csv' WITH (FORMAT csv, HEADER true)

\echo '== 백필 전'
SELECT (SELECT count(*) FROM cognito_export WHERE email <> '') AS importable,
       (SELECT count(*) FROM cognito_export WHERE email = '')  AS skipped_no_email,
       (SELECT count(*) FROM users) AS users_before;

INSERT INTO users (id, name, email, email_verified, cognito_mfa_enabled, created_at, updated_at)
SELECT
  sub,
  COALESCE(NULLIF(name, ''), split_part(email, '@', 1)),
  email,
  COALESCE(email_verified, false) AND status = 'CONFIRMED',
  COALESCE(mfa_enabled, false),
  now(),
  now()
FROM cognito_export
WHERE email <> ''
ON CONFLICT (id) DO UPDATE
  SET cognito_mfa_enabled = EXCLUDED.cognito_mfa_enabled,
      updated_at          = now();

\echo '== 백필 후'
SELECT count(*) AS users_after,
       count(*) FILTER (WHERE email_verified)     AS verified,
       count(*) FILTER (WHERE cognito_mfa_enabled) AS cognito_mfa
FROM users;

\echo '== Organization 소유자 중 users 에 없는 sub (0 이어야 정상; 있으면 삭제된 Cognito 사용자 잔존 데이터)'
SELECT count(DISTINCT o.user_id) AS orphan_owner_ids
FROM organizations o
LEFT JOIN users u ON u.id = o.user_id
WHERE u.id IS NULL;

COMMIT;
