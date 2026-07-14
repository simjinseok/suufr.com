import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { CreateStudentShareDto } from './dto/create-student-share.dto';
import { getStudentBalances } from '../common/utils/student-balance';
import crypto from 'crypto';

// 공유 뷰에 노출할 최근 세션 수 (docs/schema-redesign.md §6-11)
const SHARE_RECENT_SESSIONS = 20;

function generateShareId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const length = 8;
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

@Injectable()
export class StudentSharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  async create(dto: CreateStudentShareDto, userId: string, expiresInDays = 7) {
    const student = await this.prisma.student.findFirst({
      where: {
        uuid: dto.studentUuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with UUID ${dto.studentUuid} not found`);
    }

    const shareId = generateShareId();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const share = await this.prisma.studentShare.create({
      data: {
        shareId,
        studentId: student.id,
        showPayments: dto.showPayments ?? true,
        expiresAt,
      },
    });

    return {
      success: true,
      data: { shareId: share.shareId, showPayments: share.showPayments, expiresAt: share.expiresAt },
    };
  }

  async findAllByStudent(studentUuid: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        uuid: studentUuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with UUID ${studentUuid} not found`);
    }

    const shares = await this.prisma.studentShare.findMany({
      where: { studentId: student.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { shareId: true, showPayments: true, expiresAt: true, createdAt: true },
    });

    return { success: true, data: shares };
  }

  async remove(shareId: string, userId: string) {
    const share = await this.prisma.studentShare.findFirst({
      where: {
        shareId,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
    });

    if (!share) {
      throw new NotFoundException('Share link not found');
    }

    await this.prisma.studentShare.update({
      where: { id: share.id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async getByShareId(shareId: string) {
    const share = await this.prisma.studentShare.findUnique({
      where: { shareId },
      select: {
        shareId: true,
        showPayments: true,
        expiresAt: true,
        deletedAt: true,
        student: {
          select: {
            id: true,
            name: true,
            nextPaymentAt: true,
            deletedAt: true,
            organization: {
              select: {
                name: true,
                logoImageUrl: true,
                profileName: true,
                profileImageUrl: true,
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!share || share.deletedAt || share.expiresAt < new Date()) {
      // 만료/삭제/미존재는 모두 404 (공유 페이지에서 깔끔한 not-found 처리)
      throw new NotFoundException('Share link not found');
    }

    if (share.student.deletedAt) {
      throw new NotFoundException('Student not found');
    }

    // 최근 세션 (표시용 제한 — 수년치 이력·미디어를 한 페이지에 쏟지 않음)
    const recentSessions = await this.prisma.session.findMany({
      where: { studentId: share.student.id, deletedAt: null },
      orderBy: { sessionAt: 'desc' },
      take: SHARE_RECENT_SESSIONS,
      select: {
        uuid: true,
        sessionAt: true,
        duration: true,
        notes: true,
        isDone: true,
        type: true,
        feedback: {
          where: { deletedAt: null },
          select: { notes: true },
        },
        sessionMediaFiles: {
          orderBy: { createdAt: 'asc' },
          select: {
            mediaFile: {
              select: { uuid: true, url: true, type: true, fileName: true },
            },
          },
        },
      },
    });

    // 납부 상태 (showPayments 켜진 공유만) — 미수 여부만 노출, 금액은 비노출 (§6-10)
    // 판정은 학생 단위 잔액: 미수 = Σprice − Σ양수입금 (환불은 미수를 만들지 않는다)
    let hasUnpaid: boolean | null = null;
    if (share.showPayments) {
      const balances = await getStudentBalances(this.prisma, [share.student.id]);
      hasUnpaid = (balances.get(share.student.id)?.outstandingAmount ?? 0) > 0;
    }

    // 공유 링크 만료까지 남은 시간 (초)
    const expiresInSeconds = Math.max(
      Math.floor((share.expiresAt.getTime() - Date.now()) / 1000),
      3600, // 최소 1시간
    );

    // 비로그인 공유 뷰의 표기 기준 타임존 = 소유자(튜터)의 설정. userId 자체는 노출하지 않는다
    const { userId: ownerUserId, ...organization } = share.student.organization;
    const ownerSettings = await this.prisma.userSettings.findUnique({
      where: { userId: ownerUserId },
      select: { timezone: true },
    });

    const data = this.transformMediaUrlsToSigned(
      {
        student: {
          name: share.student.name,
          nextPaymentAt: share.showPayments ? share.student.nextPaymentAt : null,
          organization,
        },
        showPayments: share.showPayments,
        hasUnpaid,
        sessions: recentSessions.slice().reverse(), // 화면은 오래된 순
      },
      expiresInSeconds,
    );

    return {
      success: true,
      data: {
        ...data,
        timezone: ownerSettings?.timezone ?? 'UTC',
        expiresAt: share.expiresAt,
      },
    };
  }

  /**
   * 공유 데이터 내의 모든 미디어 파일 URL을 CloudFront Signed URL로 변환.
   * CloudFront signing이 설정되지 않은 경우 원본 URL 유지
   */
  private transformMediaUrlsToSigned<T extends { sessions?: unknown; student?: unknown }>(
    payload: T,
    expiresInSeconds: number,
  ): T {
    if (!this.s3Service.isSigningConfigured()) {
      return payload;
    }

    // Deep clone to avoid mutating original
    const result = JSON.parse(JSON.stringify(payload));

    if (result.sessions) {
      for (const session of result.sessions) {
        if (session.sessionMediaFiles) {
          for (const smf of session.sessionMediaFiles) {
            if (smf.mediaFile?.url) {
              const signedUrl = this.getSignedUrlFromCdnUrl(smf.mediaFile.url, expiresInSeconds);
              if (signedUrl) {
                smf.mediaFile.url = signedUrl;
              }
            }
          }
        }
      }
    }

    // 조직 프로필/로고 이미지도 서명 (비로그인 공유 뷰에서 users/ 보호경로 접근용)
    const organization = result.student?.organization;
    if (organization) {
      if (organization.profileImageUrl) {
        const signed = this.getSignedUrlFromCdnUrl(organization.profileImageUrl, expiresInSeconds);
        if (signed) organization.profileImageUrl = signed;
      }
      if (organization.logoImageUrl) {
        const signed = this.getSignedUrlFromCdnUrl(organization.logoImageUrl, expiresInSeconds);
        if (signed) organization.logoImageUrl = signed;
      }
    }

    return result;
  }

  /**
   * CDN URL에서 S3 key를 추출하고 signed URL 생성
   */
  private getSignedUrlFromCdnUrl(cdnUrl: string, expiresInSeconds: number): string | null {
    try {
      const url = new URL(cdnUrl);
      const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;

      // users/ 경로의 파일만 signed URL로 변환 (보호된 파일)
      if (key.startsWith('users/')) {
        return this.s3Service.getSignedDownloadUrl(key, expiresInSeconds);
      }

      // 공개 파일은 원본 URL 유지
      return null;
    }
    catch {
      return null;
    }
  }

  /**
   * [레거시] 구 LessonShare 공개 조회 — 링크는 최대 7일 만료라 lessons drop 마이그레이션 전까지만 유지.
   * 응답 형태는 구 getByShareId와 동일 (payment는 존재 여부만).
   */
  async getByLegacyLessonShareId(shareId: string) {
    const share = await this.prisma.lessonShare.findUnique({
      where: { shareId },
      select: {
        shareId: true,
        expiresAt: true,
        deletedAt: true,
        lesson: {
          select: {
            uuid: true,
            title: true,
            notes: true,
            deletedAt: true,
            student: {
              select: {
                name: true,
                nextPaymentAt: true,
                organization: {
                  select: {
                    name: true,
                    logoImageKey: true,
                    logoImageUrl: true,
                    profileName: true,
                    profileImageUrl: true,
                    userId: true,
                  },
                },
              },
            },
            sessions: {
              where: { deletedAt: null },
              orderBy: { sessionAt: 'asc' },
              select: {
                uuid: true,
                sessionAt: true,
                duration: true,
                notes: true,
                isDone: true,
                feedback: {
                  where: { deletedAt: null },
                  select: { notes: true },
                },
                sessionMediaFiles: {
                  orderBy: { createdAt: 'asc' },
                  select: {
                    mediaFile: {
                      select: { uuid: true, url: true, type: true, fileName: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!share || share.deletedAt || share.expiresAt < new Date()) {
      throw new NotFoundException('Share link not found');
    }

    if (share.lesson.deletedAt) {
      throw new NotFoundException('Lesson not found');
    }

    const expiresInSeconds = Math.max(
      Math.floor((share.expiresAt.getTime() - Date.now()) / 1000),
      3600,
    );

    // 표기 기준 타임존 = 소유자(튜터)의 설정. userId 자체는 노출하지 않는다
    const { userId: ownerUserId, ...organization } = share.lesson.student.organization;
    const ownerSettings = await this.prisma.userSettings.findUnique({
      where: { userId: ownerUserId },
      select: { timezone: true },
    });

    // 구 응답 형태 유지 — 입금이 학생 직속이 되어 청구별 납부 여부를 알 수 없으므로 payment는 항상 null (뱃지 미표시)
    const lesson = this.transformMediaUrlsToSigned(
      {
        ...share.lesson,
        student: { ...share.lesson.student, organization },
        payment: null,
      },
      expiresInSeconds,
    );

    return {
      success: true,
      data: {
        lesson,
        timezone: ownerSettings?.timezone ?? 'UTC',
        expiresAt: share.expiresAt,
      },
    };
  }
}
