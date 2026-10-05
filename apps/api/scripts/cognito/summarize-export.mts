/**
 * Phase 0 — export JSON 요약 및 DB 대조용 CSV 생성
 *
 * 출력:
 *   - 콘솔: 상태별 인원, MFA 사용자 수, 미인증 수, 임시비밀번호 수, 이메일 누락, 소문자 기준 중복 이메일
 *   - <out>/cognito-subs.csv : sub,email,status,mfa_enabled  (db-crosscheck.sql 의 \copy 입력)
 *
 * 실행 (apps/api 에서):
 *   node scripts/cognito/summarize-export.mts [export경로] [출력디렉터리]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExportedUser } from './export-users.mts';

const inPath = resolve(process.argv[2] || 'scripts/cognito/out/cognito-users.json');
const outDir = resolve(process.argv[3] || 'scripts/cognito/out');

const { users, exportedAt } = JSON.parse(readFileSync(inPath, 'utf8')) as { users: ExportedUser[]; exportedAt: string };

const count = <T>(arr: T[], pred: (x: T) => boolean) => arr.filter(pred).length;
const byStatus: Record<string, number> = {};
for (const u of users) byStatus[u.status] = (byStatus[u.status] ?? 0) + 1;

const emailGroups = new Map<string, ExportedUser[]>();
for (const u of users) {
  if (!u.email) continue;
  emailGroups.set(u.email, [...(emailGroups.get(u.email) ?? []), u]);
}
const duplicateEmails = [...emailGroups.entries()].filter(([, g]) => g.length > 1);

const summary = {
  exportedAt,
  total: users.length,
  byStatus,
  enabled: count(users, u => u.enabled),
  disabled: count(users, u => !u.enabled),
  // better-auth 전환 판단 지표
  mfaEnabled: count(users, u => u.mfaEnabled), // → Phase 5 재등록 대상 (requiresTwoFactorSetup)
  unconfirmed: count(users, u => u.status === 'UNCONFIRMED'), // → 가입 미완료, Cognito 잔여 인증 경로 필요
  forceChangePassword: count(users, u => u.status === 'FORCE_CHANGE_PASSWORD'), // → NEW_PASSWORD_REQUIRED 레거시 경로
  emailVerifiedFalse: count(users, u => !u.emailVerified),
  missingEmail: count(users, u => !u.email),
  missingName: count(users, u => !u.name), // → 백필 시 이메일 로컬파트로 대체
  duplicateLowercaseEmails: duplicateEmails.map(([email, g]) => ({ email, subs: g.map(x => x.sub), statuses: g.map(x => x.status) })),
  missingSub: count(users, u => !u.sub),
};

console.log(JSON.stringify(summary, null, 2));

if (duplicateEmails.length > 0) {
  console.error(`\n경고: 소문자 기준 중복 이메일 ${duplicateEmails.length}건 — better-auth users.email 은 UNIQUE 이므로 백필 전에 정리 필요`);
}

mkdirSync(outDir, { recursive: true });
const csv = ['sub,email,status,mfa_enabled', ...users.filter(u => u.sub).map(u =>
  [u.sub, u.email ?? '', u.status, u.mfaEnabled ? 'true' : 'false'].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','),
)].join('\n');
const csvPath = resolve(outDir, 'cognito-subs.csv');
writeFileSync(csvPath, csv + '\n');
console.log(`\nDB 대조용 CSV → ${csvPath}`);
