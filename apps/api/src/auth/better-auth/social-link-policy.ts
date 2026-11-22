import type { BetterAuthOptions } from 'better-auth';

type AccountCreateBeforeHook = NonNullable<NonNullable<NonNullable<NonNullable<BetterAuthOptions['databaseHooks']>['account']>['create']>['before']>;

/** 같은 이메일의 기존 사용자에 자동 연결되는 소셜 provider. auth.config 의 trustedProviders 도 이 목록을 쓴다 */
export const EMAIL_LINKED_SOCIAL_PROVIDERS: readonly string[] = ['google', 'apple'];

/**
 * 소셜 계정이 기존 사용자에 연결되기 직전, 그 사용자가 이메일 미인증이면 기존 세션을 모두 폐기하고 비밀번호(credential 계정)를 지운다.
 * 미인증 계정은 소유권이 증명되지 않았으므로, 남의 이메일로 먼저 가입해 둔 사람이 비밀번호·세션으로 계속 접근하는 것을 막는다.
 * 계정(users 행)과 데이터는 그대로이고, 새 소셜 로그인 세션만 남는다.
 *
 * create.before 훅이라 소셜 account 행 INSERT 전에 돈다(better-auth 1.7.26 with-hooks.mjs:11-24). 여기서 던지면 행이 생기지 않고
 * link-account.mjs:216 catch 가 `unable to link account`(401)를 돌려준다. 그래서 재시도도 다시 '연결' 경로로 와서 이 훅이 또 돈다
 * — 정리가 끝나지 않으면 연결도 없다. (after 훅이면 행이 먼저 남아 재시도가 '이미 연결됨' 경로로 가고, 훅은 다시 돌지 않은 채
 * emailVerified 만 true 가 된다.)
 * 순서는 세션 폐기 → 비밀번호 삭제다. 반대면 비밀번호만 지워지고 세션 폐기가 실패했을 때 재시도에서 credential 이 없어 세션이 남는다.
 * 이 훅이 성공한 뒤 INSERT 가 실패해도 비밀번호·세션만 사라진 상태(fail-closed)라 재로그인으로 복구된다.
 *
 * link-account.mjs 순서: 이 훅 → 연결 INSERT(192행) → emailVerified 갱신(224행) → 세션 생성(373행).
 * 그래서 여기서 읽는 emailVerified 는 연결 직전 값이고, 폐기 대상에 새 세션은 없다.
 * 신규 가입(사용자와 계정을 함께 생성)은 credential 계정이 없어 아무것도 하지 않는다.
 * 엔드포인트 밖(internalAdapter 직접 호출)에서 만든 계정은 context 가 없어 건너뛴다 — 앱 코드에 그런 소셜 계정 생성은 없다.
 */
export const revokePasswordOnUnverifiedSocialLink: AccountCreateBeforeHook = async (account, context) => {
  if (!account.providerId || !EMAIL_LINKED_SOCIAL_PROVIDERS.includes(account.providerId)) return;
  const adapter = context?.context.internalAdapter;
  if (!adapter || !account.userId) return;

  const user = await adapter.findUserById(account.userId);
  if (!user || user.emailVerified) return;
  const credential = await adapter.findCredentialAccount(account.userId);
  if (!credential) return;

  await adapter.deleteUserSessions(account.userId);
  await adapter.deleteAccount(credential.id);
};
