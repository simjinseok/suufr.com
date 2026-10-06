/**
 * Phase 0 — AWS CLI(CloudShell) 로 뽑은 Cognito 사용자 목록을 export-users.mts 와 같은 JSON 으로 변환
 *
 * 로컬에 AWS 자격증명이 없을 때 쓴다. AWS 콘솔 우상단 CloudShell 에서 (리전: 서울):
 *   POOL=ap-northeast-2_XXXXXXX
 *   aws cognito-idp list-users --user-pool-id $POOL --output json > users.json
 *   # (선택) MFA 설정 여부 — 사용자 수만큼 호출하므로 수백 명이면 1~2분
 *   for u in $(jq -r '.Users[].Username' users.json); do
 *     aws cognito-idp admin-get-user --user-pool-id $POOL --username "$u" --output json
 *   done > mfa.json
 * 두 파일을 CloudShell 의 Actions > Download file 로 내려받은 뒤 (apps/api 에서):
 *   node scripts/cognito/convert-cli-export.mts <users.json> [mfa.json] [출력경로]
 * 이후 summarize-export.mts → backfill-users.sql 순서는 동일하다.
 *
 * list-users 는 CLI 가 페이지를 자동으로 합쳐 Users 배열 하나로 준다.
 * mfa.json 은 JSON 객체가 연달아 붙은 형태(JSON Lines 유사)여도 된다.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ExportedUser } from './export-users.mts';

type Attr = { Name: string; Value?: string };
type CliUser = {
  Username: string;
  Attributes?: Attr[];
  UserAttributes?: Attr[];
  UserStatus?: string;
  Enabled?: boolean;
  UserCreateDate?: string | number;
  UserLastModifiedDate?: string | number;
  UserMFASettingList?: string[];
  PreferredMfaSetting?: string;
};

const [, , usersPath, mfaPathOrOut, outArg] = process.argv;
if (!usersPath) {
  console.error('사용법: node scripts/cognito/convert-cli-export.mts <users.json> [mfa.json] [출력경로]');
  process.exit(1);
}
// 인자 3개면 두 번째가 mfa.json. 인자 2개면 파일명에 'mfa' 가 있을 때만 mfa.json, 아니면 출력 경로
const secondIsMfa = Boolean(outArg) || (Boolean(mfaPathOrOut) && /mfa/i.test(mfaPathOrOut!));
const mfaPath = secondIsMfa ? mfaPathOrOut : undefined;
const outPath = resolve(outArg ?? (secondIsMfa ? undefined : mfaPathOrOut) ?? 'scripts/cognito/out/cognito-users.json');

/** 객체가 연달아 붙은 파일(`{...}\n{...}`)도 파싱한다 */
function parseConcatenatedJson(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const single = JSON.parse(trimmed);
    return Array.isArray(single) ? single : [single];
  }
  catch {
    const items: unknown[] = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (inString) {
        if (ch === '\\') i++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      }
      else if (ch === '}') {
        depth--;
        if (depth === 0 && start >= 0) {
          items.push(JSON.parse(trimmed.slice(start, i + 1)));
          start = -1;
        }
      }
    }
    return items;
  }
}

function attr(attrs: Attr[] | undefined, name: string): string | null {
  return attrs?.find(a => a.Name === name)?.Value ?? null;
}

function toIso(value: string | number | undefined): string | null {
  if (value === undefined || value === null) return null;
  const d = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const listed = JSON.parse(readFileSync(usersPath, 'utf8')) as { Users?: CliUser[] } | CliUser[];
const users: CliUser[] = Array.isArray(listed) ? listed : (listed.Users ?? []);

const mfaByUsername = new Map<string, CliUser>();
if (mfaPath) {
  for (const item of parseConcatenatedJson(readFileSync(mfaPath, 'utf8')) as CliUser[]) {
    if (item?.Username) mfaByUsername.set(item.Username, item);
  }
}

const exported: ExportedUser[] = users.map((u) => {
  const detail = mfaByUsername.get(u.Username);
  const attrs = detail?.UserAttributes ?? u.Attributes ?? u.UserAttributes;
  const emailRaw = attr(attrs, 'email');
  return {
    sub: attr(attrs, 'sub') ?? '',
    username: u.Username,
    email: emailRaw ? emailRaw.trim().toLowerCase() : null,
    emailRaw,
    name: attr(attrs, 'name'),
    emailVerified: attr(attrs, 'email_verified') === 'true',
    status: detail?.UserStatus ?? u.UserStatus ?? 'UNKNOWN',
    enabled: detail?.Enabled ?? u.Enabled ?? true,
    mfaEnabled: (detail?.UserMFASettingList ?? u.UserMFASettingList ?? []).includes('SOFTWARE_TOKEN_MFA'),
    preferredMfa: detail?.PreferredMfaSetting ?? u.PreferredMfaSetting ?? null,
    createdAt: toIso(detail?.UserCreateDate ?? u.UserCreateDate),
    updatedAt: toIso(detail?.UserLastModifiedDate ?? u.UserLastModifiedDate),
  };
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ exportedAt: new Date().toISOString(), source: 'aws-cli', users: exported }, null, 2));
console.log(`${exported.length}명 → ${outPath}${mfaPath ? ` (MFA 정보 ${mfaByUsername.size}명 반영)` : ' (MFA 정보 없음 — mfa.json 을 주면 반영)'}`);
if (!mfaPath) console.log('주의: MFA 정보가 없으면 backfill 의 cognito_mfa_enabled 가 모두 false 가 됩니다.');
console.log('다음: node scripts/cognito/summarize-export.mts');
