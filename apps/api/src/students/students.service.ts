import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import { Prisma } from '@prisma/generated/client';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: number, query: ListStudentsQueryDto) {
    const { page = 1, limit = 20, status, q } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = {
      organizationId,
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

  async findOne(uuid: string, organizationId: number) {
    const student = await this.prisma.student.findUnique({
      where: { uuid },
    });

    if (!student || student.deletedAt) {
      throw new NotFoundException(`Student with UUID ${uuid} not found`);
    }

    if (student.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    return { success: true, data: student };
  }

  async create(dto: CreateStudentDto, organizationId: number, userId: string) {
    const student = await this.prisma.student.create({
      data: {
        name: dto.name,
        notes: dto.notes ?? '',
        phone: dto.phone,
        email: dto.email,
        nextPaymentAt: dto.nextPaymentAt ? new Date(dto.nextPaymentAt) : null,
        organizationId,
        userId,
      },
    });

    return { success: true, data: student };
  }

  async update(uuid: string, dto: UpdateStudentDto, organizationId: number) {
    const existing = await this.prisma.student.findUnique({
      where: { uuid },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Student with UUID ${uuid} not found`);
    }

    if (existing.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

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

  async remove(uuid: string, organizationId: number) {
    const existing = await this.prisma.student.findUnique({
      where: { uuid },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Student with UUID ${uuid} not found`);
    }

    if (existing.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.student.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async getStats(uuid: string, organizationId: number) {
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
        AND s.organization_id = ${organizationId}
        AND s.deleted_at IS NULL
      GROUP BY s.id
    `;

    if (!stats) {
      throw new NotFoundException(`Student with UUID ${uuid} not found`);
    }

    return { success: true, data: stats };
  }
}
