import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import { Prisma } from '@prisma/generated/client';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async findAll(query: ListStudentsQueryDto, userId: string) {
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
    const student = await this.prisma.student.findFirst({
      where: {
        uuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with UUID ${uuid} not found`);
    }

    return { success: true, data: student };
  }

  async create(dto: CreateStudentDto, userId: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { uuid: dto.organizationUuid, userId, deletedAt: null },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // 플랜별 학생 수 한도 (계정 기준 전 조직 합산, 기존 초과분은 유지하고 신규 등록만 차단)
    const { limits } = await this.subscriptionsService.getEntitlements(userId);
    if (limits.maxStudents !== null) {
      const studentCount = await this.subscriptionsService.countBillableStudents(userId);
      if (studentCount >= limits.maxStudents) {
        throw new ForbiddenException({
          message: `무료 플랜에서는 수강생을 최대 ${limits.maxStudents}명까지 등록할 수 있어요. 프로 플랜으로 업그레이드하면 제한 없이 등록할 수 있습니다.`,
          error: 'STUDENT_LIMIT_EXCEEDED',
        });
      }
    }

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
    const existing = await this.prisma.student.findFirst({
      where: {
        uuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Student with UUID ${uuid} not found`);
    }

    // profileImageUrl 처리: temp URL이면 images 폴더로 이동
    let finalProfileImageUrl: string | null | undefined = undefined;
    let oldImageUrlToDelete: string | null = null;

    if (dto.profileImageUrl !== undefined) {
      if (dto.profileImageUrl && dto.profileImageUrl.includes('suufr/temp/')) {
        // temp에서 images로 이동
        const moved = await this.s3Service.moveFileByContentType(dto.profileImageUrl, 'image/jpeg');
        finalProfileImageUrl = moved?.url ?? null;
        // 기존 이미지는 response 후에 삭제
        oldImageUrlToDelete = existing.profileImageUrl;
      }
      else if (dto.profileImageUrl === null || dto.profileImageUrl === '') {
        // 이미지 제거
        finalProfileImageUrl = null;
        oldImageUrlToDelete = existing.profileImageUrl;
      }
      else {
        // 이미 정식 URL인 경우 (변경 없음)
        finalProfileImageUrl = dto.profileImageUrl;
      }
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
        ...(finalProfileImageUrl !== undefined && { profileImageUrl: finalProfileImageUrl }),
      },
    });

    // 기존 이미지 삭제 (response 후 비동기로 처리)
    if (oldImageUrlToDelete) {
      setImmediate(() => {
        this.s3Service.deleteByUrl(oldImageUrlToDelete).catch((err) => {
          console.error('Failed to delete old image:', err);
        });
      });
    }

    return { success: true, data: student };
  }

  async remove(uuid: string, userId: string) {
    const existing = await this.prisma.student.findFirst({
      where: {
        uuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Student with UUID ${uuid} not found`);
    }

    await this.prisma.student.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async getStats(uuid: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        uuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with UUID ${uuid} not found`);
    }

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

    return {
      success: true,
      data: {
        ...(stats ?? { remainingSessionsCount: 0, completedLessonCount: 0, unpaidLessonCount: 0 }),
        nextPaymentAt: student.nextPaymentAt,
      },
    };
  }
}
