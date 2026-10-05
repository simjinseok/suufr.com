/**
 * Phase 0 — Cognito 유저풀 사용자 export
 *
 * ListUsers(60건/페이지)로 전 사용자를 받고, AdminGetUser로 MFA 설정을 보강해 JSON으로 저장한다.
 * 비밀번호는 export 되지 않는다(Cognito가 제공하지 않음). 출력 파일은 개인정보이므로 레포 밖 또는
 * .gitignore 된 out/ 에만 두고 절대 커밋하지 않는다.
 *
 * 실행 (apps/api 에서, Node 24 — 타입 스트리핑 내장):
 *   node --env-file=.env scripts/cognito/export-users.mts [출력경로]
 * 필요 환경변수: COGNITO_USERPOOL_ID, AWS_REGION, AWS 자격증명(기본 체인: 프로파일/환경변수/SSO)
 *   - IAM 권한: cognito-idp:ListUsers, cognito-idp:AdminGetUser
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminGetUserCommand,
  type UserType,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';

export type ExportedUser = {
  sub: string;
  username: string;
  email: string | null; // 소문자 정규화 (better-auth 조회 기준)
  emailRaw: string | null;
  name: string | null;
  emailVerified: boolean;
  status: string; // CONFIRMED | UNCONFIRMED | FORCE_CHANGE_PASSWORD | RESET_REQUIRED | ...
  enabled: boolean;
  mfaEnabled: boolean; // SOFTWARE_TOKEN_MFA 설정 여부
  preferredMfa: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const userPoolId = process.env.COGNITO_USERPOOL_ID;
if (!userPoolId) {
  console.error('COGNITO_USERPOOL_ID 가 필요합니다');
  process.exit(1);
}

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'ap-northeast-2' });
const outPath = resolve(process.argv[2] || 'scripts/cognito/out/cognito-users.json');

function attr(attrs: AttributeType[] | undefined, name: string): string | null {
  return attrs?.find(a => a.Name === name)?.Value ?? null;
}

async function listAllUsers(): Promise<UserType[]> {
  const users: UserType[] = [];
  let token: string | undefined;
  do {
    const res = await client.send(new ListUsersCommand({ UserPoolId: userPoolId, Limit: 60, PaginationToken: token }));
    users.push(...(res.Users ?? []));
    token = res.PaginationToken;
    process.stderr.write(`\rListUsers: ${users.length}명`);
  } while (token);
  process.stderr.write('\n');
  return users;
}

// AdminGetUser 는 UserRead 카테고리 레이트리밋이 있어 동시성을 제한한다
async function withConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
      if (i % 50 === 0) process.stderr.write(`\rAdminGetUser: ${i}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  process.stderr.write(`\rAdminGetUser: ${items.length}/${items.length}\n`);
  return results;
}

async function main() {
  const users = await listAllUsers();

  const exported = await withConcurrency(users, 5, async (u): Promise<ExportedUser> => {
    const detail = await client.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: u.Username! }));
    const attrs = detail.UserAttributes ?? u.Attributes;
    const emailRaw = attr(attrs, 'email');
    return {
      sub: attr(attrs, 'sub')!,
      username: u.Username!,
      email: emailRaw ? emailRaw.trim().toLowerCase() : null,
      emailRaw,
      name: attr(attrs, 'name'),
      emailVerified: attr(attrs, 'email_verified') === 'true',
      status: detail.UserStatus ?? u.UserStatus ?? 'UNKNOWN',
      enabled: detail.Enabled ?? u.Enabled ?? true,
      mfaEnabled: (detail.UserMFASettingList ?? []).includes('SOFTWARE_TOKEN_MFA'),
      preferredMfa: detail.PreferredMfaSetting ?? null,
      createdAt: (detail.UserCreateDate ?? u.UserCreateDate)?.toISOString() ?? null,
      updatedAt: (detail.UserLastModifiedDate ?? u.UserLastModifiedDate)?.toISOString() ?? null,
    };
  });

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ exportedAt: new Date().toISOString(), userPoolId, users: exported }, null, 2));
  console.log(`${exported.length}명 → ${outPath}`);
  console.log('요약은 scripts/cognito/summarize-export.mts 로 확인하세요.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
