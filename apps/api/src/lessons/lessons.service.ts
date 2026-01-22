import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { ListLessonsQueryDto } from './dto/list-lessons-query.dto';
import { Prisma } from '@prisma/generated/client';

function generateShareId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkMembership(userId: string, organizationId: number) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!member) {
      throw new ForbiddenException('Access denied');
    }

    return member;
  }

  private async getLessonWithOrganization(uuid: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { uuid },
      include: { student: { select: { organizationId: true } } },
    });

    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException(`Lesson with UUID ${uuid} not found`);
    }

    return lesson;
  }

  async findAll(query: ListLessonsQueryDto, userId: string) {
    // 사용자가 속한 모든 organization 조회
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId, deletedAt: null, organization: { deletedAt: null } },
      include: { organization: { select: { id: true, uuid: true } } },
    });
    const userOrgUuids = memberships.map(m => m.organization.uuid);
    const userOrgIds = memberships.map(m => m.organizationId);

    // organizationUuids가 지정되면 사용자가 속한 organization만 필터링
    let orgIds: number[];
    if (query.organizationUuids && query.organizationUuids.length > 0) {
      const filteredUuids = query.organizationUuids.filter(uuid => userOrgUuids.includes(uuid));
      orgIds = memberships
        .filter(m => filteredUuids.includes(m.organization.uuid))
        .map(m => m.organizationId);
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
          },
          payment: true,
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
    const lesson = await this.getLessonWithOrganization(uuid);
    await this.checkMembership(userId, lesson.student.organizationId);

    const fullLesson = await this.prisma.lesson.findUnique({
      where: { uuid },
      include: {
        student: true,
        sessions: {
          where: { deletedAt: null },
          orderBy: { sessionAt: 'asc' },
          include: { feedback: true },
        },
        payment: true,
        shares: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return { success: true, data: fullLesson };
  }

  async create(dto: CreateLessonDto, userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { uuid: dto.studentUuid },
    });

    if (!student || student.deletedAt) {
      throw new NotFoundException(`Student with UUID ${dto.studentUuid} not found`);
    }

    const member = await this.checkMembership(userId, student.organizationId);

    const lesson = await this.prisma.lesson.create({
      data: {
        title: dto.title,
        notes: dto.notes ?? '',
        studentId: student.id,
        memberId: member.id,
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
      include: {
        student: true,
        sessions: {
          where: { deletedAt: null },
          orderBy: { sessionAt: 'asc' },
        },
      },
    });

    return { success: true, data: lesson };
  }

  async update(uuid: string, dto: UpdateLessonDto, userId: string) {
    const lesson = await this.getLessonWithOrganization(uuid);
    await this.checkMembership(userId, lesson.student.organizationId);

    const updatedLesson = await this.prisma.lesson.update({
      where: { uuid },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        student: true,
        sessions: {
          where: { deletedAt: null },
          orderBy: { sessionAt: 'asc' },
        },
        payment: true,
      },
    });

    return { success: true, data: updatedLesson };
  }

  async remove(uuid: string, userId: string) {
    const lesson = await this.getLessonWithOrganization(uuid);
    await this.checkMembership(userId, lesson.student.organizationId);

    await this.prisma.lesson.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async createShare(uuid: string, userId: string, expiresInDays = 7) {
    const lesson = await this.getLessonWithOrganization(uuid);
    await this.checkMembership(userId, lesson.student.organizationId);

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
    const lesson = await this.getLessonWithOrganization(uuid);
    await this.checkMembership(userId, lesson.student.organizationId);

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
              },
            },
            member: {
              select: {
                name: true,
                profileImageKey: true,
                organization: {
                  select: {
                    name: true,
                    logoImageKey: true,
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
