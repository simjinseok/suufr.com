import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../prisma/prisma.service';
import { AccountDeletionService, STALE_CLAIM_MS } from './account-deletion.service';

/** 동의 이력: 탈퇴 후 3년 (개인정보처리방침 3조) */
export const CONSENT_RETENTION_YEARS = 3;
/** 대금결제 기록(주문·웹훅 원문)과 탈퇴 기록: 5년 (전자상거래법) */
export const PAYMENT_RECORD_RETENTION_YEARS = 5;

/** now 에서 달력 기준으로 years 년 전 (365일×N 은 윤년만큼 일찍 파기한다). 이 시각보다 앞선 탈퇴가 파기 대상이다 */
export function retentionCutoff(now: Date, years: number): Date {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  return cutoff;
}
/** 한 번에 처리하는 탈퇴 기록 수 (IN 목록 크기) */
const BATCH_SIZE = 500;

/**
 * 탈퇴 후처리 크론.
 * - 매일: 보존 기간이 지난 보존 데이터(user_consents 3년, subscription_orders·웹훅 원문 5년)와 탈퇴 기록(5년)을 파기한다.
 *   기간은 탈퇴 기록의 deleted_at 기준이다 — 방침에 적힌 기간을 코드로 지킨다.
 * - 매시: 스토리지 삭제(storage_purged_at IS NULL)를 다시 시도하고, 끝나지 못한 선점 행(users 가 남아 있음)을 푼다.
 */
@Injectable()
export class AccountDeletionCleanupService {
  private readonly logger = new Logger(AccountDeletionCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountDeletion: AccountDeletionService,
  ) {}

  // 매일 UTC 03:00 (KST 12:00)
  @Cron('0 3 * * *', { timeZone: 'UTC' })
  async purgeExpiredRecords(): Promise<void> {
    const now = new Date();
    try {
      // 동의 이력: 3년 지난 탈퇴 전부 (행이 없으면 no-op). 탈퇴 기록은 5년까지 남으므로 오래된 것부터 끊어 읽어도 같은 묶음만 반복하지 않게 커서로 끝까지 읽는다
      let consentCount = 0;
      for await (const userIds of this.completedDeletions(retentionCutoff(now, CONSENT_RETENTION_YEARS))) {
        const { count } = await this.prisma.userConsent.deleteMany({ where: { userId: { in: userIds } } });
        consentCount += count;
      }
      if (consentCount > 0) this.logger.log(`Purged ${consentCount} consent record(s) of deleted accounts`);

      // 결제 기록·탈퇴 기록: 5년. 사용자 단위 트랜잭션으로 지운다
      let expiredUsers = 0;
      for await (const userIds of this.completedDeletions(retentionCutoff(now, PAYMENT_RECORD_RETENTION_YEARS))) {
        for (const userId of userIds) {
          await this.prisma.$transaction([
            this.prisma.subscriptionOrder.deleteMany({ where: { userId } }),
            // 웹훅 원문에는 사용자 컬럼이 없다. 체크아웃이 서명해 심은 custom_data.userId 로 찾는다 (Paddle 원문은 snake_case)
            this.prisma.billingWebhookEvent.deleteMany({ where: { payload: { path: ['data', 'custom_data', 'userId'], equals: userId } } }),
            this.prisma.userConsent.deleteMany({ where: { userId } }),
            this.prisma.accountDeletion.delete({ where: { userId } }),
          ]);
          expiredUsers += 1;
        }
      }
      if (expiredUsers > 0) this.logger.log(`Purged payment records and tombstones of ${expiredUsers} deleted account(s)`);
    }
    catch (error) {
      this.logger.error('탈퇴 보존 데이터 파기 실패', error instanceof Error ? error.stack : String(error));
      Sentry.captureException(error, { tags: { feature: 'account-deletion' } });
    }
  }

  // 매시 45분
  @Cron('45 * * * *', { timeZone: 'UTC' })
  async retryPendingStorage(): Promise<void> {
    const pending = await this.prisma.accountDeletion.findMany({
      where: { storagePurgedAt: null, deletedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } },
      select: { userId: true },
      take: BATCH_SIZE,
    });
    for (const { userId } of pending) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (user) {
        // 트랜잭션까지 가지 못하고 중단된 시도. 선점이 남아 있으면 웹훅이 이 (살아 있는) 사용자의 구독을 반영하지 못하므로 푼다
        await this.prisma.accountDeletion.deleteMany({ where: { userId, deletedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } } });
        this.logger.warn(`Released stale account deletion claim of user ${userId}`);
        continue;
      }
      // 사용자 prefix + 탈퇴 트랜잭션이 저장해 둔 legacy 키(pending_storage_keys)
      await this.accountDeletion.purgeStorage(userId);
    }
  }

  /** deleted_at 이 cutoff 이전이고 users 가 실제로 지워진(완료된) 탈퇴의 userId 를 BATCH_SIZE 묶음으로 끝까지 읽는다 */
  private async* completedDeletions(cutoff: Date): AsyncGenerator<string[]> {
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.accountDeletion.findMany({
        where: { deletedAt: { lt: cutoff }, ...(cursor ? { userId: { gt: cursor } } : {}) },
        select: { userId: true },
        orderBy: { userId: 'asc' },
        take: BATCH_SIZE,
      });
      const last = rows.at(-1);
      if (!last) return;
      cursor = last.userId;
      const alive = await this.prisma.user.findMany({ where: { id: { in: rows.map(row => row.userId) } }, select: { id: true } });
      const aliveIds = new Set(alive.map(user => user.id));
      const completed = rows.map(row => row.userId).filter(userId => !aliveIds.has(userId));
      if (completed.length > 0) yield completed;
      if (rows.length < BATCH_SIZE) return;
    }
  }
}
