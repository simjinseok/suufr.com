import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileImageService } from '../s3/profile-image.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import { Prisma } from '@prisma/generated/client';
import { getStudentBalances, EMPTY_BALANCE } from '../common/utils/student-balance';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileImageService: ProfileImageService,
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

    // 상태를 지정해 등록하면 상태 이력도 함께 남긴다(상태변경 트랜잭션과 동일한 불변식: Student.status = 최신 이력).
    const student = await this.prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          name: dto.name,
          notes: dto.notes ?? '',
          phone: dto.phone,
          email: dto.email,
          nextPaymentAt: dto.nextPaymentAt ? new Date(dto.nextPaymentAt) : null,
          status: dto.status,
          organizationId: organization.id,
          userId,
        },
      });

      if (dto.status) {
        await tx.studentStatus.create({
          data: {
            status: dto.status,
            studentId: created.id,
          },
        });
      }

      return created;
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

    // profileImageUrl 커밋 (검증 + pending 태그 제거). 실패 시 여기서 throw → DB 미변경
    const imageChange = await this.profileImageService.commitChange(
      userId,
      dto.profileImageUrl,
      existing.profileImageUrl,
    );

    let student;
    try {
      student = await this.prisma.student.update({
        where: { uuid },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.nextPaymentAt !== undefined && {
            nextPaymentAt: dto.nextPaymentAt ? new Date(dto.nextPaymentAt) : null,
          }),
          ...(imageChange.url !== undefined && { profileImageUrl: imageChange.url }),
        },
      });
    }
    catch (error) {
      // 커밋(태그 제거)까지 된 신규 객체가 참조 없이 남지 않도록 정리
      this.profileImageService.scheduleDeletion(imageChange.url);
      throw error;
    }

    // 기존 이미지 삭제 (response 후 비동기로 처리)
    this.profileImageService.scheduleDeletion(imageChange.previousUrlToDelete);

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

    // 파생 계산: 잔여 세션 수 + 학생 잔액 + 청구 완료 수 (docs/schema-redesign.md §3)
    const [remainingSessionsCount, invoices, balances] = await Promise.all([
      this.prisma.session.count({
        where: { studentId: student.id, isDone: false, deletedAt: null },
      }),
      this.prisma.invoice.findMany({
        where: { studentId: student.id, deletedAt: null },
        select: {
          price: true,
          sessions: { where: { deletedAt: null }, select: { isDone: true } },
        },
      }),
      getStudentBalances(this.prisma, [student.id]),
    ]);

    let completedInvoiceCount = 0;
    let needsPriceCount = 0;
    for (const invoice of invoices) {
      if (invoice.sessions.every(s => s.isDone)) {
        completedInvoiceCount += 1;
      }
      // price=0 = "금액 미입력" — 잔액에 잡히지 않으므로 별도 노출
      if (invoice.price === 0) {
        needsPriceCount += 1;
      }
    }

    const balance = balances.get(student.id) ?? EMPTY_BALANCE;

    return {
      success: true,
      data: {
        remainingSessionsCount,
        completedInvoiceCount,
        outstandingAmount: balance.outstandingAmount,
        creditAmount: balance.creditAmount,
        needsPriceCount,
        nextPaymentAt: student.nextPaymentAt,
      },
    };
  }
}
