-- 미인증 로그인 차단 배포 시 1회 실행: 비밀번호(credential) 계정이 있는데 이메일이 미인증인 사용자의 세션을 지운다.
-- 다음 로그인 때 인증코드 화면으로 가고, 인증하면 데이터는 그대로다.
-- Google 로만 가입한 사용자(credential 계정 없음)의 세션은 건드리지 않는다. 사용자·계정·데이터는 지우지 않는다.
DELETE FROM "auth_sessions" AS s
USING "users" AS u
WHERE s."user_id" = u."id"
  AND u."email_verified" = false
  AND EXISTS (
    SELECT 1 FROM "accounts" AS a
    WHERE a."user_id" = u."id"
      AND a."provider_id" = 'credential'
  );
