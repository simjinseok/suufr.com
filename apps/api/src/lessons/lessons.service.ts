import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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
              feedback: {
                include: {
                  feedbackMediaFiles: {
                    orderBy: { createdAt: 'asc' },
                    include: { mediaFile: true },
                  },
                },
              },
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
            feedback: {
              include: {
                feedbackMediaFiles: {
                  orderBy: { createdAt: 'asc' },
                  include: { mediaFile: true },
                },
              },
            },
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

    const share = await this.prisma.sessionShare.create({
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

    const share = await this.prisma.sessionShare.findFirst({
      where: { shareId, lessonId: lesson.id, deletedAt: null },
    });

    if (!share) {
      throw new NotFoundException('Share link not found');
    }

    await this.prisma.sessionShare.update({
      where: { id: share.id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async getByShareId(shareId: string) {
    const share = await this.prisma.sessionShare.findUnique({
      where: { shareId },
      include: {
        lesson: {
          include: {
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
              include: {
                feedback: {
                  where: { deletedAt: null },
                  include: {
                    feedbackMediaFiles: {
                      orderBy: { createdAt: 'asc' },
                      include: { mediaFile: true },
                    },
                  },
                },
                sessionMediaFiles: {
                  orderBy: { createdAt: 'asc' },
                  include: { mediaFile: true },
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

    return {
      success: true,
      data: {
        lesson: share.lesson,
        expiresAt: share.expiresAt,
      },
    };
  }
}
