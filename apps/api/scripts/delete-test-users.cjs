/**
 * 개발 DB 의 테스트 계정 삭제. 로컬 검증(가입·인증·재설정 흐름)으로 생긴 계정을 관련 행까지 지운다.
 * 빌드된 Prisma 클라이언트(dist)를 쓰므로 먼저 `pnpm --filter=api build` 가 필요하다.
 *
 *   node --env-file=.env scripts/delete-test-users.cjs a@example.com b@example.com          # 조회만(dry-run)
 *   node --env-file=.env scripts/delete-test-users.cjs --yes a@example.com b@example.com    # 삭제
 *
 * 안전장치: @example.com(RFC 2606 예약 도메인) 이메일만 받고, NODE_ENV=production 이면 거부하며,
 * 수강생·수업·커리큘럼·파일이 하나라도 있는 계정은 테스트 계정이 아니라고 보고 전체를 중단한다.
 * users 에 FK 가 없는 테이블(organizations, user_settings, user_consents, user_subscriptions 등)은 직접 지우고,
 * auth_sessions·accounts·two_factors 는 users 삭제 시 CASCADE 된다. organization_members 는 Prisma 모델이 없어 SQL 로 지운다.
 */
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client');

const TEST_DOMAIN = '@example.com';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('운영 환경에서는 실행할 수 없습니다');
  const args = process.argv.slice(2);
  const confirm = args.includes('--yes');
  const emails = args.filter(a => a !== '--yes').map(e => e.trim().toLowerCase());
  if (emails.length === 0) throw new Error('삭제할 이메일을 인자로 주세요');
  const bad = emails.filter(e => !e.endsWith(TEST_DOMAIN));
  if (bad.length) throw new Error(`${TEST_DOMAIN} 이메일만 지울 수 있습니다: ${bad.join(', ')}`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.POSTGRES_PRISMA_URL }) });
  try {
    const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true, createdAt: true } });
    const missing = emails.filter(e => !users.some(u => u.email === e));
    if (missing.length) console.log(`없는 계정(건너뜀): ${missing.join(', ')}`);
    if (users.length === 0) return;
    const ids = users.map(u => u.id);
    const orgIds = (await prisma.organization.findMany({ where: { userId: { in: ids } }, select: { id: true } })).map(o => o.id);
    const byUser = { userId: { in: ids } };
    const otpIdentifiers = { OR: emails.map(e => ({ identifier: { endsWith: `:${e}` } })) };

    const guard = {
      students: await prisma.student.count({ where: { OR: [byUser, { organizationId: { in: orgIds } }] } }),
      meetings: await prisma.meeting.count({ where: { OR: [byUser, { organizationId: { in: orgIds } }] } }),
      curriculums: await prisma.curriculum.count({ where: { organizationId: { in: orgIds } } }),
      mediaFiles: await prisma.mediaFile.count({ where: byUser }),
    };
    const counts = {
      users: users.length,
      organizations: orgIds.length,
      authSessions: await prisma.authSession.count({ where: byUser }),
      accounts: await prisma.account.count({ where: byUser }),
      userSettings: await prisma.userSettings.count({ where: byUser }),
      userConsents: await prisma.userConsent.count({ where: byUser }),
      userSubscriptions: await prisma.userSubscription.count({ where: byUser }),
      subscriptionOrders: await prisma.subscriptionOrder.count({ where: byUser }),
      storageQuotas: await prisma.userStorageQuota.count({ where: byUser }),
      folders: await prisma.folder.count({ where: byUser }),
      appTokens: await prisma.appToken.count({ where: byUser }),
      externalServiceTokens: await prisma.externalServiceToken.count({ where: byUser }),
      googleSyncTokens: await prisma.googleSyncToken.count({ where: byUser }),
      verifications: await prisma.verification.count({ where: otpIdentifiers }),
      ...guard,
    };
    for (const u of users) console.log(`- ${u.email}  (${u.id}, ${u.createdAt.toISOString()})`);
    console.table(counts);

    if (guard.students || guard.meetings || guard.curriculums || guard.mediaFiles) {
      throw new Error('수강생·수업·커리큘럼·파일이 있는 계정이 포함되어 있어 중단합니다 (테스트 계정이 아닐 수 있음)');
    }
    if (!confirm) {
      console.log('dry-run: 실제로 지우려면 --yes 를 붙이세요');
      return;
    }

    await prisma.$transaction([
      prisma.userConsent.deleteMany({ where: byUser }),
      prisma.subscriptionOrder.deleteMany({ where: byUser }),
      prisma.userSubscription.deleteMany({ where: byUser }),
      prisma.userStorageQuota.deleteMany({ where: byUser }),
      prisma.userSettings.deleteMany({ where: byUser }),
      prisma.folder.deleteMany({ where: byUser }),
      prisma.appToken.deleteMany({ where: byUser }),
      prisma.externalServiceToken.deleteMany({ where: byUser }),
      prisma.googleSyncToken.deleteMany({ where: byUser }),
      prisma.$executeRaw`DELETE FROM organization_members WHERE organization_id = ANY(${orgIds}::int[]) OR user_id = ANY(${ids}::uuid[])`,
      prisma.organization.deleteMany({ where: { id: { in: orgIds } } }),
      prisma.verification.deleteMany({ where: otpIdentifiers }),
      // auth_sessions / accounts / two_factors 는 CASCADE
      prisma.user.deleteMany({ where: { id: { in: ids } } }),
    ]);
    console.log(`삭제 완료: ${users.map(u => u.email).join(', ')}`);
  }
  finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
