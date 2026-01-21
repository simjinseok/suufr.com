import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { UpsertFeedbackDto } from './dto/feedback.dto';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { Prisma } from '@prisma/generated/client';

@Injectable()
export class SessionsService {
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

  private async checkOwnership(userId: string, organizationId: number) {
    const member = await this.checkMembership(userId, organizationId);

    if (member.role !== 'owner') {
      throw new ForbiddenException('Owner permission required');
    }

    return member;
  }

  private async checkOwnerOrLessonMember(userId: string, organizationId: number, lessonMemberId: number) {
    const member = await this.checkMembership(userId, organizationId);

    if (member.role !== 'owner' && member.id !== lessonMemberId) {
      throw new ForbiddenException('Owner or lesson member permission required');
    }

    return member;
  }

  private async getSessionWithOrganization(uuid: string) {
    const session = await this.prisma.session.findUnique({
      where: { uuid },
      include: {
        lesson: {
          include: { student: { select: { organizationId: true } } },
        },
      },
    });

    if (!session || session.deletedAt) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    return session;
  }

  async findAll(query: ListSessionsQueryDto, userId: string) {
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
    } else {
      orgIds = userOrgIds;
    }

    const { page = 1, limit = 20, lessonUuid, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    // lessonUuid로 필터링 시 lesson의 organizationId 검증
    let lessonId: number | undefined;
    if (lessonUuid) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { uuid: lessonUuid },
        include: { student: { select: { organizationId: true } } },
      });
      if (lesson && !lesson.deletedAt && orgIds.includes(lesson.student.organizationId)) {
        lessonId = lesson.id;
      } else {
        return {
          success: true,
          data: [],
          meta: { page, limit, totalCount: 0, totalPages: 0 },
        };
      }
    }

    const where: Prisma.SessionWhereInput = {
      deletedAt: null,
      ...(lessonId && { lessonId }),
      ...(dateFrom || dateTo) && {
        sessionAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      },
      lesson: {
        deletedAt: null,
        student: {
          deletedAt: null,
          organizationId: { in: orgIds },
        },
      },
    };

    const [sessions, totalCount] = await Promise.all([
      this.prisma.session.findMany({
        where,
        include: {
          lesson: {
            include: { student: true },
          },
          feedback: true,
        },
        orderBy: { sessionAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.session.count({ where }),
    ]);

    return {
      success: true,
      data: sessions,
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async findOne(uuid: string, userId: string) {
    const session = await this.getSessionWithOrganization(uuid);
    await this.checkMembership(userId, session.lesson.student.organizationId);

    const fullSession = await this.prisma.session.findUnique({
      where: { uuid },
      include: {
        lesson: {
          include: { student: true },
        },
        feedback: true,
      },
    });

    return { success: true, data: fullSession };
  }

  async create(dto: CreateSessionDto, userId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { uuid: dto.lessonUuid },
      include: { student: true },
    });

    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException(`Lesson with UUID ${dto.lessonUuid} not found`);
    }

    await this.checkOwnership(userId, lesson.student.organizationId);

    const session = await this.prisma.session.create({
      data: {
        sessionAt: new Date(dto.sessionAt),
        duration: dto.duration ?? 60,
        notes: dto.notes ?? '',
        lessonId: lesson.id,
      },
      include: {
        lesson: {
          include: { student: true },
        },
        feedback: true,
      },
    });

    return { success: true, data: session };
  }

  async update(uuid: string, dto: UpdateSessionDto, userId: string) {
    const session = await this.getSessionWithOrganization(uuid);
    await this.checkOwnerOrLessonMember(userId, session.lesson.student.organizationId, session.lesson.memberId);

    const updatedSession = await this.prisma.session.update({
      where: { uuid },
      data: {
        ...(dto.sessionAt !== undefined && { sessionAt: new Date(dto.sessionAt) }),
        ...(dto.duration !== undefined && { duration: dto.duration }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isDone !== undefined && { isDone: dto.isDone }),
      },
      include: {
        lesson: {
          include: { student: true },
        },
        feedback: true,
      },
    });

    return { success: true, data: updatedSession };
  }

  async remove(uuid: string, userId: string) {
    const session = await this.getSessionWithOrganization(uuid);
    await this.checkOwnership(userId, session.lesson.student.organizationId);

    await this.prisma.session.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async markDone(uuid: string, isDone: boolean, userId: string) {
    const session = await this.getSessionWithOrganization(uuid);
    await this.checkOwnerOrLessonMember(userId, session.lesson.student.organizationId, session.lesson.memberId);

    const updatedSession = await this.prisma.session.update({
      where: { uuid },
      data: { isDone },
      include: {
        lesson: {
          include: { student: true },
        },
        feedback: true,
      },
    });

    return { success: true, data: updatedSession };
  }

  async upsertFeedback(uuid: string, dto: UpsertFeedbackDto, userId: string) {
    const session = await this.prisma.session.findUnique({
      where: { uuid },
      include: {
        lesson: {
          include: { student: { select: { organizationId: true } } },
        },
        feedback: true,
      },
    });

    if (!session || session.deletedAt) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    await this.checkOwnerOrLessonMember(userId, session.lesson.student.organizationId, session.lesson.memberId);

    let feedback;
    if (session.feedback) {
      feedback = await this.prisma.feedback.update({
        where: { id: session.feedback.id },
        data: { notes: dto.notes },
      });
    } else {
      feedback = await this.prisma.feedback.create({
        data: {
          notes: dto.notes,
          sessionId: session.id,
        },
      });
    }

    return { success: true, data: feedback };
  }

  async deleteFeedback(uuid: string, userId: string) {
    const session = await this.prisma.session.findUnique({
      where: { uuid },
      include: {
        lesson: {
          include: { student: { select: { organizationId: true } } },
        },
        feedback: true,
      },
    });

    if (!session || session.deletedAt) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    await this.checkOwnerOrLessonMember(userId, session.lesson.student.organizationId, session.lesson.memberId);

    if (!session.feedback) {
      throw new NotFoundException('Feedback not found');
    }

    await this.prisma.feedback.update({
      where: { id: session.feedback.id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
