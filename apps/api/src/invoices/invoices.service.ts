import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { Prisma } from '@prisma/generated/client';

// 목록/상세에서 공통으로 쓰는 include — 파생 계산(잔여 회차)은 클라이언트에서 수행
// 납부 상태는 청구가 아니라 학생 단위 잔액으로 파생하므로 payments를 포함하지 않는다
const INVOICE_INCLUDE = {
  student: true,
  sessions: {
    where: { deletedAt: null },
    orderBy: { sessionAt: 'asc' as const },
    include: {
      feedback: true,
      sessionMediaFiles: {
        orderBy: { createdAt: 'asc' as const },
        include: { mediaFile: true },
      },
    },
  },
} satisfies Prisma.InvoiceInclude;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListInvoicesQueryDto, userId: string) {
    const organizations = await this.prisma.organization.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, uuid: true },
    });
    const userOrgUuids = organizations.map(o => o.uuid);
    const userOrgIds = organizations.map(o => o.id);

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
        return {
          success: true,
          data: [],
          meta: { page, limit, totalCount: 0, totalPages: 0 },
        };
      }
    }

    const where: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      ...(studentId && { studentId }),
      student: {
        deletedAt: null,
        organizationId: { in: orgIds },
      },
    };

    const [invoices, totalCount] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        // 시작일 내림차순. periodStart는 nullable이라 값이 없는 건 뒤로 보내고,
        // 같은 시작일(또는 둘 다 null)이면 최근 생성 순으로 안정 정렬한다.
        orderBy: [
          { periodStart: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      success: true,
      data: invoices,
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async findOne(uuid: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
      include: INVOICE_INCLUDE,
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with UUID ${uuid} not found`);
    }

    return { success: true, data: invoice };
  }

  async create(dto: CreateInvoiceDto, userId: string) {
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

    // 귀속할 기존 세션 검증 (같은 학생 소유여야 함)
    let sessionsToAttach: { id: number }[] = [];
    if (dto.sessionUuids && dto.sessionUuids.length > 0) {
      sessionsToAttach = await this.prisma.session.findMany({
        where: {
          uuid: { in: dto.sessionUuids },
          studentId: student.id,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (sessionsToAttach.length !== dto.sessionUuids.length) {
        throw new BadRequestException('일부 세션을 찾을 수 없거나 이 학생의 세션이 아닙니다.');
      }
    }

    const sessionsToCreate = (dto.sessions ?? []).map((s) => ({
      sessionAt: new Date(s.sessionAt),
      duration: s.duration ?? 60,
      notes: s.notes ?? '',
    }));

    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          title: dto.title,
          price: dto.price,
          totalCount: dto.totalCount,
          periodStart: dto.periodStart ? new Date(dto.periodStart) : undefined,
          periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : undefined,
          autoRenew: dto.autoRenew ?? false,
          renewDaysBefore: dto.renewDaysBefore ?? 0,
          notes: dto.notes,
          studentId: student.id,
          sessions: sessionsToCreate.length > 0
            ? {
                create: sessionsToCreate.map((s) => ({
                  sessionAt: s.sessionAt,
                  duration: s.duration,
                  notes: s.notes,
                  studentId: student.id,
                })),
              }
            : undefined,
        },
      });

      if (sessionsToAttach.length > 0) {
        await tx.session.updateMany({
          where: { id: { in: sessionsToAttach.map(s => s.id) } },
          data: { invoiceId: created.id },
        });
      }

      // "전액 입금 받음" — 청구와 동시에 학생 앞으로 입금 기록
      if (dto.initialPayment) {
        await tx.payment.create({
          data: {
            amount: dto.initialPayment.amount ?? dto.price,
            method: dto.initialPayment.method,
            paidAt: new Date(dto.initialPayment.paidAt),
            studentId: student.id,
          },
        });
      }

      return created;
    });

    return this.findOne(invoice.uuid, userId);
  }

  async update(uuid: string, dto: UpdateInvoiceDto, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with UUID ${uuid} not found`);
    }

    // 귀속 추가 대상 검증 (같은 학생 소유여야 함)
    let sessionsToAdd: { id: number }[] = [];
    if (dto.addSessionUuids && dto.addSessionUuids.length > 0) {
      sessionsToAdd = await this.prisma.session.findMany({
        where: {
          uuid: { in: dto.addSessionUuids },
          studentId: invoice.studentId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (sessionsToAdd.length !== dto.addSessionUuids.length) {
        throw new BadRequestException('일부 세션을 찾을 수 없거나 이 학생의 세션이 아닙니다.');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { uuid },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.totalCount !== undefined && { totalCount: dto.totalCount }),
          ...(dto.periodStart !== undefined && { periodStart: new Date(dto.periodStart) }),
          ...(dto.periodEnd !== undefined && { periodEnd: new Date(dto.periodEnd) }),
          ...(dto.autoRenew !== undefined && { autoRenew: dto.autoRenew }),
          ...(dto.renewDaysBefore !== undefined && { renewDaysBefore: dto.renewDaysBefore }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      });

      if (sessionsToAdd.length > 0) {
        await tx.session.updateMany({
          where: { id: { in: sessionsToAdd.map(s => s.id) } },
          data: { invoiceId: invoice.id },
        });
      }

      if (dto.removeSessionUuids && dto.removeSessionUuids.length > 0) {
        await tx.session.updateMany({
          where: {
            uuid: { in: dto.removeSessionUuids },
            invoiceId: invoice.id,
          },
          data: { invoiceId: null },
        });
      }
    });

    return this.findOne(uuid, userId);
  }

  async remove(uuid: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with UUID ${uuid} not found`);
    }

    // 청구만 soft delete — 귀속 세션의 invoiceId는 유지하되,
    // 파생 계산에서 "삭제된 청구의 세션 = 미연결"로 취급한다 (docs/schema-redesign.md §3)
    await this.prisma.invoice.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
