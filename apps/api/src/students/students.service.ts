import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import { Prisma } from '@prisma/generated/client';

@Injectable()
export class StudentsService {
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

  async findAll(query: ListStudentsQueryDto, userId: string) {
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

    const { page = 1, limit = 20, status, q } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = {
      organizationId: { in: orgIds },
      deletedAt: null,
      ...(status && { status: status as any }),
      ...(q && { name: { contains: q, mode: 'insensitive' } }),
    };

    const [students, totalCount] = await Promise.all([
      this.prisma.student.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      success: true,
      data: students,
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async findOne(uuid: string, userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { uuid },
    });

    if (!student || student.deletedAt) {
      throw new NotFoundException(`Student with UUID ${uuid} not found`);
    }

    await this.checkMembership(userId, student.organizationId);

    return { success: true, data: student };
  }

  async create(dto: CreateStudentDto, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { uuid: dto.organizationUuid },
    });

    if (!organization || organization.deletedAt) {
      throw new NotFoundException('Organization not found');
    }

    await this.checkOwnership(userId, organization.id);

    const student = await this.prisma.student.create({
      data: {
        name: dto.name,
        notes: dto.notes ?? '',
        phone: dto.phone,
        email: dto.email,
        nextPaymentAt: dto.nextPaymentAt ? new Date(dto.nextPaymentAt) : null,
        organizationId: organization.id,
        userId,
      },
    });

    return { success: true, data: student };
  }

  async update(uuid: string, dto: UpdateStudentDto, userId: string) {
    const existing = await this.prisma.student.findUnique({
      where: { uuid },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Student with UUID ${uuid} not found`);
    }

    await this.checkOwnership(userId, existing.organizationId);

    const student = await this.prisma.student.update({
      where: { uuid },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.nextPaymentAt !== undefined && {
          nextPaymentAt: dto.nextPaymentAt ? new Date(dto.nextPaymentAt) : null,
        }),
        ...(dto.profileImageKey !== undefined && { profileImageKey: dto.profileImageKey }),
      },
    });

    return { success: true, data: student, oldProfileImageKey: existing.profileImageKey };
  }

  async remove(uuid: string, userId: string) {
    const existing = await this.prisma.student.findUnique({
      where: { uuid },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Student with UUID ${uuid} not found`);
    }

    await this.checkOwnership(userId, existing.organizationId);

    await this.prisma.student.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async getStats(uuid: string, userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { uuid },
    });

    if (!student || student.deletedAt) {
      throw new NotFoundException(`Student with UUID ${uuid} not found`);
    }

    await this.checkMembership(userId, student.organizationId);

    type StatsResult = {
      remainingSessionsCount: number;
      completedLessonCount: number;
      unpaidLessonCount: number;
    };

    const [stats] = await this.prisma.$queryRaw<StatsResult[]>`
      SELECT
        CAST(COUNT(sess.id) FILTER (
          WHERE sess.is_done = false AND sess.deleted_at IS NULL
        ) AS INT) AS "remainingSessionsCount",
        CAST(COUNT(DISTINCT les.id) FILTER (
          WHERE les.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM sessions sess2
            WHERE sess2.lesson_id = les.id
            AND sess2.deleted_at IS NULL
            AND sess2.is_done = false
          )
        ) AS INT) AS "completedLessonCount",
        CAST(COUNT(DISTINCT les.id) FILTER (
          WHERE les.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM payments p
            WHERE p.lesson_id = les.id
            AND p.deleted_at IS NULL
          )
        ) AS INT) AS "unpaidLessonCount"
      FROM students s
      LEFT JOIN lessons les ON les.student_id = s.id
      LEFT JOIN sessions sess ON sess.lesson_id = les.id
      WHERE s.uuid = ${uuid}::uuid
        AND s.deleted_at IS NULL
      GROUP BY s.id
    `;

    return { success: true, data: stats ?? { remainingSessionsCount: 0, completedLessonCount: 0, unpaidLessonCount: 0 } };
  }
}
