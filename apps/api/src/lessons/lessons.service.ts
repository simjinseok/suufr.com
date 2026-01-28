import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { ListLessonsQueryDto } from './dto/list-lessons-query.dto';
import { Prisma } from '@prisma/generated/client';
import crypto from 'crypto';

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
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  async findAll(query: ListLessonsQueryDto, userId: string) {
    // 사용자가 소유한 모든 organization 조회
    const organizations = await this.prisma.organization.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, uuid: true },
    });
    const userOrgUuids = organizations.map(o => o.uuid);
    const userOrgIds = organizations.map(o => o.id);

    // organizationUuids가 지정되면 사용자가 소유한 organization만 필터링
    let orgIds: number[];
    if (query.organizationUuids && query.organizationUuids.length > 0) {
      const filteredUuids = query.organizationUuids.filter(uuid => userOrgUuids.includes(uuid));
      orgIds = organizations
        .filter(o => filteredUuids.includes(o.uuid))
        .map(o => o.id);
    }
    else {
      orgIds = userOrgIds;
    }

    const { page = 1, limit = 20, studentUuid } = query;
    const skip = (page - 1) * limit;

    // studentUuid로 필터링 시 student의 organizationId 검증
    let studentId: number | undefined;
    if (studentUuid) {
      const student = await this.prisma.student.findUnique({
        where: { uuid: studentUuid },
      });
      if (student && !student.deletedAt && orgIds.includes(student.organizationId)) {
        studentId = student.id;
      }
      else {
        // student가 없거나 권한이 없으면 빈 결과 반환
        return {
          success: true,
          data: [],
          meta: { page, limit, totalCount: 0, totalPages: 0 },
        };
      }
    }

    const where: Prisma.LessonWhereInput = {
      deletedAt: null,
      ...(studentId && { studentId }),
      student: {
        deletedAt: null,
        organizationId: { in: orgIds },
      },
    };

    const [lessons, totalCount] = await Promise.all([
      this.prisma.lesson.findMany({
        where,
        include: {
          student: true,
          sessions: {
            where: { deletedAt: null },
            orderBy: { sessionAt: 'asc' },
            include: {
              feedback: true,
              sessionMediaFiles: {
                orderBy: { createdAt: 'asc' },
                include: { mediaFile: true },
              },
            },
          },
          payment: {
            where: {
              deletedAt: null,
            },
          },
          shares: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.lesson.count({ where }),
    ]);

    return {
      success: true,
      data: lessons,
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async findOne(uuid: string, userId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
      include: {
        student: true,
        sessions: {
          where: { deletedAt: null },
          orderBy: { sessionAt: 'asc' },
          include: {
            feedback: true,
            sessionMediaFiles: {
              orderBy: { createdAt: 'asc' },
              include: { mediaFile: true },
            },
          },
        },
        payment: {
          where: { deletedAt: null },
        },
        shares: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with UUID ${uuid} not found`);
    }

    return { success: true, data: lesson };
  }

  async create(dto: CreateLessonDto, userId: string) {
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

    const lesson = await this.prisma.lesson.create({
      data: {
        title: dto.title,
        notes: dto.notes ?? '',
        studentId: student.id,
        sessions: dto.sessions
          ? {
              create: dto.sessions.map((s) => ({
                sessionAt: new Date(s.sessionAt),
                duration: s.duration ?? 60,
                notes: s.notes ?? '',
              })),
            }
          : undefined,
      },
    });

    // 생성된 레슨 조회하여 반환
    return this.findOne(lesson.uuid, userId);
  }

  async update(uuid: string, dto: UpdateLessonDto, userId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with UUID ${uuid} not found`);
    }

    await this.prisma.lesson.update({
      where: { uuid },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    // 업데이트된 레슨 조회하여 반환
    return this.findOne(uuid, userId);
  }

  async remove(uuid: string, userId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with UUID ${uuid} not found`);
    }

    await this.prisma.lesson.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async createShare(uuid: string, userId: string, expiresInDays = 7) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with UUID ${uuid} not found`);
    }

    const shareId = generateShareId();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const share = await this.prisma.lessonShare.create({
      data: {
        shareId,
        lessonId: lesson.id,
        expiresAt,
      },
    });

    return { success: true, data: { shareId: share.shareId, expiresAt: share.expiresAt } };
  }

  async deleteShare(uuid: string, shareId: string, userId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with UUID ${uuid} not found`);
    }

    const share = await this.prisma.lessonShare.findFirst({
      where: { shareId, lessonId: lesson.id, deletedAt: null },
    });

    if (!share) {
      throw new NotFoundException('Share link not found');
    }

    await this.prisma.lessonShare.update({
      where: { id: share.id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async getByShareId(shareId: string) {
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
                  },
                },
              },
            },
            payment: {
              where: { deletedAt: null },
              select: { id: true },
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
                  select: {
                    notes: true,
                  },
                },
                sessionMediaFiles: {
                  orderBy: { createdAt: 'asc' },
                  select: {
                    mediaFile: {
                      select: {
                        uuid: true,
                        url: true,
                        type: true,
                        fileName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!share || share.deletedAt) {
      throw new NotFoundException('Share link not found');
    }

    if (share.expiresAt < new Date()) {
      throw new ForbiddenException('Share link has expired');
    }

    if (share.lesson.deletedAt) {
      throw new NotFoundException('Lesson not found');
    }

    // 공유 링크 만료까지 남은 시간 (초)
    const expiresInSeconds = Math.max(
      Math.floor((share.expiresAt.getTime() - Date.now()) / 1000),
      3600, // 최소 1시간
    );

    // 미디어 파일 URL을 signed URL로 변환
    const lessonWithSignedUrls = this.transformMediaUrlsToSigned(
      share.lesson,
      expiresInSeconds,
    );

    return {
      success: true,
      data: {
        lesson: lessonWithSignedUrls,
        expiresAt: share.expiresAt,
      },
    };
  }

  /**
   * 레슨 데이터 내의 모든 미디어 파일 URL을 CloudFront Signed URL로 변환
   * CloudFront signing이 설정되지 않은 경우 원본 URL 유지
   */
  private transformMediaUrlsToSigned<T>(lesson: T, expiresInSeconds: number): T {
    if (!this.s3Service.isSigningConfigured()) {
      return lesson;
    }

    // Deep clone to avoid mutating original
    const result = JSON.parse(JSON.stringify(lesson));

    // sessions 내의 미디어 파일 변환
    if (result.sessions) {
      for (const session of result.sessions) {
        // sessionMediaFiles
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
    } catch {
      return null;
    }
  }
}
