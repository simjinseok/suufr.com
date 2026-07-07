import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

export interface StorageQuota {
  usedBytes: number;
  quotaBytes: number;
  remainingBytes: number;
}

@Injectable()
export class StorageQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * 사용자의 스토리지 용량 정보 조회
   * 레코드가 없으면 기본값으로 생성. 용량은 플랜에 따라 결정
   */
  async getQuota(userId: string): Promise<StorageQuota> {
    const [quota, quotaBytes] = await Promise.all([
      this.prisma.userStorageQuota.upsert({
        where: { userId },
        create: {
          userId,
          usedBytes: BigInt(0),
        },
        update: {},
      }),
      this.subscriptionsService.getStorageQuotaBytes(userId),
    ]);

    const usedBytes = Number(quota.usedBytes);

    return {
      usedBytes,
      quotaBytes,
      remainingBytes: Math.max(0, quotaBytes - usedBytes),
    };
  }

  /**
   * 업로드 가능 여부 확인
   * @param userId - 사용자 ID
   * @param fileSize - 업로드할 파일 크기 (바이트)
   */
  async canUpload(userId: string, fileSize: number): Promise<boolean> {
    const quota = await this.getQuota(userId);
    return quota.remainingBytes >= fileSize;
  }

  /**
   * 여러 파일의 총 용량이 업로드 가능한지 확인
   * @param userId - 사용자 ID
   * @param fileSizes - 업로드할 파일들의 크기 배열 (바이트)
   */
  async canUploadMultiple(userId: string, fileSizes: number[]): Promise<boolean> {
    const totalSize = fileSizes.reduce((sum, size) => sum + size, 0);
    return this.canUpload(userId, totalSize);
  }

  /**
   * 사용량 증가 (파일 업로드 시)
   * @param userId - 사용자 ID
   * @param bytes - 증가할 바이트 수
   */
  async increaseUsage(userId: string, bytes: number): Promise<void> {
    await this.prisma.userStorageQuota.upsert({
      where: { userId },
      create: {
        userId,
        usedBytes: BigInt(bytes),
      },
      update: {
        usedBytes: {
          increment: BigInt(bytes),
        },
      },
    });
  }

  /**
   * 비관적 락을 사용한 용량 예약 (동시성 제어)
   * 동시 업로드 시 Race Condition 방지
   * @param userId - 사용자 ID
   * @param fileSize - 예약할 파일 크기 (바이트)
   * @returns 예약 성공 여부
   */
  async reserveQuotaWithLock(
    userId: string,
    fileSize: number,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    // 트랜잭션(행 잠금) 시간을 늘리지 않도록 용량 한도는 트랜잭션 밖에서 조회
    const quotaBytes = await this.subscriptionsService.getStorageQuotaBytes(userId);

    const run = async (client: Prisma.TransactionClient) => {
      // FOR UPDATE로 행 잠금
      const result = await client.$queryRaw<Array<{ used_bytes: bigint }>>`
        SELECT used_bytes FROM user_storage_quotas
        WHERE user_id = ${userId}::uuid
        FOR UPDATE
      `;

      const usedBytes = result[0]?.used_bytes ?? BigInt(0);

      // 용량 초과 확인
      if (Number(usedBytes) + fileSize > quotaBytes) {
        return false;
      }

      // 용량 예약 (증가)
      await client.userStorageQuota.upsert({
        where: { userId },
        create: {
          userId,
          usedBytes: BigInt(fileSize),
        },
        update: {
          usedBytes: {
            increment: BigInt(fileSize),
          },
        },
      });

      return true;
    };

    // 외부 트랜잭션이 있으면 그 안에서, 없으면 자체 트랜잭션으로 실행
    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  /**
   * 사용량 감소 (파일 삭제 시)
   * @param userId - 사용자 ID
   * @param bytes - 감소할 바이트 수
   */
  async decreaseUsage(
    userId: string,
    bytes: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    // GREATEST로 0 미만 방지하며 원자적으로 감소 (락 없는 read-modify-write race 제거)
    await tx.$executeRaw`
      UPDATE user_storage_quotas
      SET used_bytes = GREATEST(0, used_bytes - ${BigInt(bytes)})
      WHERE user_id = ${userId}::uuid
    `;
  }
}
