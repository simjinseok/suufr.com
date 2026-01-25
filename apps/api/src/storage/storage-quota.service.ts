import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// 기본 용량 100MB (구독 시스템 구현 시 동적 계산으로 변경 예정)
const DEFAULT_QUOTA_BYTES = 104857600;

export interface StorageQuota {
  usedBytes: number;
  quotaBytes: number;
  remainingBytes: number;
}

@Injectable()
export class StorageQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 사용자의 스토리지 용량 정보 조회
   * 레코드가 없으면 기본값으로 생성
   */
  async getQuota(userId: string): Promise<StorageQuota> {
    const quota = await this.prisma.userStorageQuota.upsert({
      where: { userId },
      create: {
        userId,
        usedBytes: BigInt(0),
      },
      update: {},
    });

    const usedBytes = Number(quota.usedBytes);
    const quotaBytes = DEFAULT_QUOTA_BYTES;

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
   * 사용량 감소 (파일 삭제 시)
   * @param userId - 사용자 ID
   * @param bytes - 감소할 바이트 수
   */
  async decreaseUsage(userId: string, bytes: number): Promise<void> {
    // 현재 사용량 조회
    const quota = await this.getQuota(userId);

    // 0 이하로 내려가지 않도록 보정
    const newUsedBytes = Math.max(0, quota.usedBytes - bytes);

    await this.prisma.userStorageQuota.update({
      where: { userId },
      data: {
        usedBytes: BigInt(newUsedBytes),
      },
    });
  }
}
