/**
 * Phase 5 — Cognito MFA 사용자에게 TOTP 재등록 안내 메일 1회 발송
 *
 * 입력: 이메일 목록 파일 (한 줄에 하나, mfa-reenroll-targets.sql 결과)
 * 실행 (apps/api 에서):
 *   node --env-file=.env scripts/mail/send-mfa-reenroll-notice.mts scripts/mail/out/mfa-reenroll-targets.csv [--dry-run]
 * 필요 환경변수: MAIL_FROM_ADDRESS, MAIL_FROM_NAME, WEB_URL, AWS_SES_REGION|AWS_REGION, (선택) AWS_SES_ACCESS_KEY/SECRET_KEY
 * 발송 속도는 SES 초당 한도 아래로 두기 위해 건당 200ms 간격.
 */
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { mfaReenrollMail } from '../../src/mail/templates/auth-mails.ts';

const [, , listPath, flag] = process.argv;
if (!listPath) {
  console.error('사용법: node scripts/mail/send-mfa-reenroll-notice.mts <이메일목록파일> [--dry-run]');
  process.exit(1);
}
const dryRun = flag === '--dry-run';

const from = process.env.MAIL_FROM_NAME ? `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>` : process.env.MAIL_FROM_ADDRESS;
const settingsUrl = `${process.env.WEB_URL ?? 'https://suufr.com'}/settings/security`;
if (!from) {
  console.error('MAIL_FROM_ADDRESS 가 필요합니다');
  process.exit(1);
}

const accessKeyId = process.env.AWS_SES_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SES_SECRET_KEY;
const client = new SESv2Client({
  region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'ap-northeast-2',
  ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
});

const emails = readFileSync(listPath, 'utf8').split('\n').map(l => l.trim().toLowerCase()).filter(l => l.includes('@'));
console.log(`${emails.length}명에게 발송${dryRun ? ' (dry-run)' : ''}`);

let sent = 0;
let failed = 0;
for (const email of emails) {
  const mail = mfaReenrollMail(email, settingsUrl);
  if (dryRun) {
    console.log(`[dry-run] ${email}: ${mail.subject}`);
    continue;
  }
  try {
    await client.send(new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [email] },
      Content: { Simple: {
        Subject: { Data: mail.subject, Charset: 'UTF-8' },
        Body: { Html: { Data: mail.html, Charset: 'UTF-8' }, Text: { Data: mail.text, Charset: 'UTF-8' } },
      } },
    }));
    sent++;
  }
  catch (error) {
    failed++;
    console.error(`실패 ${email}: ${error instanceof Error ? error.message : String(error)}`);
  }
  await sleep(200);
}
console.log(`완료: 성공 ${sent}, 실패 ${failed}`);
