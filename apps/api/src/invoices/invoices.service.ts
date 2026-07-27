import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { Payment, Prisma } from '@prisma/generated/client';
import { ActivitiesService, RecordActivityInput } from '../activities/activities.service';
import { buildChanges } from '../activities/activity-payload';

// 목록/상세에서 공통으로 쓰는 include — 파생 계산(잔여 회차)은 클라이언트에서 수행
// 연결된 입금(§6-22 순수 연결)은 표시용으로만 포함 — 납부 상태(미수/선납)는 여전히 학생 단위 잔액으로 파생
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
  invoicePayments: {
    where: { payment: { deletedAt: null } },
    orderBy: { payment: { paidAt: 'asc' as const } },
    include: {
      payment: { select: { uuid: true, amount: true, method: true, paidAt: true } },
    },
  },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithInclude = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>;

// 응답에서 조인 행을 감추고 연결된 입금만 평탄화해 노출
function serialize({ invoicePayments, ...invoice }: InvoiceWithInclude) {
  return { ...invoice, payments: invoicePayments.map(ip => ip.payment) };
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activitiesService: ActivitiesService,
  ) {}

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
      data: invoices.map(serialize),
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

    return { success: true, data: serialize(invoice) };
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

    // 귀속할 기존 세션 검증 (같은 학생 소유여야 함) — uuid/이전 귀속은 활동 기록용
    let sessionsToAttach: { id: number; uuid: string; invoice: { uuid: string } | null }[] = [];
    if (dto.sessionUuids && dto.sessionUuids.length > 0) {
      sessionsToAttach = await this.prisma.session.findMany({
        where: {
          uuid: { in: dto.sessionUuids },
          studentId: student.id,
          deletedAt: null,
        },
        select: { id: true, uuid: true, invoice: { select: { uuid: true } } },
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

    const { invoice, initialPayment, createdSessions } = await this.prisma.$transaction(async (tx) => {
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
        },
      });

      // nested create는 생성된 세션 uuid를 돌려주지 않는다 — 변경 피드에 세션별로 남기려면 명시 생성이어야 한다
      const sessions = sessionsToCreate.length > 0
        ? await tx.session.createManyAndReturn({
            data: sessionsToCreate.map((s) => ({
              sessionAt: s.sessionAt,
              duration: s.duration,
              notes: s.notes,
              studentId: student.id,
              invoiceId: created.id,
            })),
            select: { uuid: true, sessionAt: true, duration: true },
          })
        : [];

      if (sessionsToAttach.length > 0) {
        await tx.session.updateMany({
          where: { id: { in: sessionsToAttach.map(s => s.id) } },
          data: { invoiceId: created.id },
        });
      }

      // "전액 입금 받음" — 청구와 동시에 학생 앞으로 입금 기록 + 이 수강권에 자동 연결(§6-22)
      let payment: Payment | null = null;
      if (dto.initialPayment) {
        payment = await tx.payment.create({
          data: {
            amount: dto.initialPayment.amount ?? dto.price,
            method: dto.initialPayment.method,
            paidAt: new Date(dto.initialPayment.paidAt),
            studentId: student.id,
          },
        });

        await tx.invoicePayment.create({
          data: { invoiceId: created.id, paymentId: payment.id },
        });
      }

      return { invoice: created, initialPayment: payment, createdSessions: sessions };
    });

    // 이 한 번의 요청으로 바뀐 모든 엔티티를 1쿼리로 기록 (청구 + 함께 만들어진/귀속된 수업 + 초기 입금)
    const snapshot = { uuid: student.uuid, name: student.name };
    const activities: RecordActivityInput[] = [{
      userId,
      entityType: 'invoice',
      action: 'created',
      entityUuid: invoice.uuid,
      student: snapshot,
      payload: {
        title: invoice.title,
        price: invoice.price,
        totalCount: invoice.totalCount,
        ...(createdSessions.length > 0 && { sessionsCreated: createdSessions.length }),
        ...(sessionsToAttach.length > 0 && { sessionsAttached: sessionsToAttach.length }),
      },
    }];

    for (const session of createdSessions) {
      activities.push({
        userId,
        entityType: 'session',
        action: 'created',
        entityUuid: session.uuid,
        student: snapshot,
        payload: {
          sessionAt: session.sessionAt.toISOString(),
          duration: session.duration,
          invoiceUuid: invoice.uuid,
          bulk: true,
        },
      });
    }

    for (const session of sessionsToAttach) {
      activities.push({
        userId,
        entityType: 'session',
        action: 'updated',
        entityUuid: session.uuid,
        student: snapshot,
        payload: {
          changes: { invoiceUuid: { from: session.invoice?.uuid ?? null, to: invoice.uuid } },
          changedFields: ['invoiceUuid'],
        },
      });
    }

    // 초기 입금은 사용자 결정에 따라 입금 활동으로도 별도 기록
    if (initialPayment) {
      activities.push({
        userId,
        entityType: 'payment',
        action: 'created',
        entityUuid: initialPayment.uuid,
        student: snapshot,
        payload: {
          amount: initialPayment.amount,
          method: initialPayment.method,
          paidAt: initialPayment.paidAt.toISOString(),
          // payments.service의 연결 기록과 같은 키 — 자동 연결된 수강권
          invoiceUuids: [invoice.uuid],
        },
      });
    }

    await this.activitiesService.recordMany(activities);

    return this.findOne(invoice.uuid, userId);
  }

  async update(uuid: string, dto: UpdateInvoiceDto, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
      include: {
        student: { select: { uuid: true, name: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with UUID ${uuid} not found`);
    }

    // 귀속 추가 대상 검증 (같은 학생 소유여야 함) — uuid/이전 귀속은 활동 기록용
    let sessionsToAdd: { id: number; uuid: string; invoice: { uuid: string } | null }[] = [];
    if (dto.addSessionUuids && dto.addSessionUuids.length > 0) {
      sessionsToAdd = await this.prisma.session.findMany({
        where: {
          uuid: { in: dto.addSessionUuids },
          studentId: invoice.studentId,
          deletedAt: null,
        },
        select: { id: true, uuid: true, invoice: { select: { uuid: true } } },
      });

      if (sessionsToAdd.length !== dto.addSessionUuids.length) {
        throw new BadRequestException('일부 세션을 찾을 수 없거나 이 학생의 세션이 아닙니다.');
      }
    }

    // 실제로 이 청구에 귀속돼 있는 세션만 해제 대상 — 활동에 기록할 건수도 여기서 확정한다
    let sessionsToDetach: { id: number; uuid: string }[] = [];
    if (dto.removeSessionUuids && dto.removeSessionUuids.length > 0) {
      sessionsToDetach = await this.prisma.session.findMany({
        where: {
          uuid: { in: dto.removeSessionUuids },
          invoiceId: invoice.id,
          deletedAt: null,
        },
        select: { id: true, uuid: true },
      });
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

      if (sessionsToDetach.length > 0) {
        await tx.session.updateMany({
          where: { id: { in: sessionsToDetach.map(s => s.id) } },
          data: { invoiceId: null },
        });
      }
    });

    const built = buildChanges(invoice, dto, {
      diff: ['title', 'price', 'totalCount', 'periodStart', 'periodEnd', 'autoRenew', 'renewDaysBefore'],
      changedOnly: ['notes'],
      dateOnlyFields: ['periodStart', 'periodEnd'],
    });
    const sessionsAttached = sessionsToAdd.length;
    const sessionsDetached = sessionsToDetach.length;
    const activities: RecordActivityInput[] = [];

    if (built || sessionsAttached > 0 || sessionsDetached > 0) {
      activities.push({
        userId,
        entityType: 'invoice',
        action: 'updated',
        entityUuid: uuid,
        student: invoice.student,
        payload: {
          changes: built?.changes ?? {},
          changedFields: built?.changedFields ?? [],
          ...(sessionsAttached > 0 && { sessionsAttached }),
          ...(sessionsDetached > 0 && { sessionsDetached }),
        },
      });
    }

    // 귀속이 바뀐 수업은 세션 uuid 단위로도 남긴다 (증분 소비자가 청구 활동만으로는 어느 수업인지 알 수 없다)
    for (const session of sessionsToAdd) {
      activities.push({
        userId,
        entityType: 'session',
        action: 'updated',
        entityUuid: session.uuid,
        student: invoice.student,
        payload: {
          changes: { invoiceUuid: { from: session.invoice?.uuid ?? null, to: invoice.uuid } },
          changedFields: ['invoiceUuid'],
        },
      });
    }

    for (const session of sessionsToDetach) {
      activities.push({
        userId,
        entityType: 'session',
        action: 'updated',
        entityUuid: session.uuid,
        student: invoice.student,
        payload: {
          changes: { invoiceUuid: { from: invoice.uuid, to: null } },
          changedFields: ['invoiceUuid'],
        },
      });
    }

    await this.activitiesService.recordMany(activities);

    return this.findOne(uuid, userId);
  }

  async remove(uuid: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
      include: {
        student: { select: { uuid: true, name: true } },
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

    await this.activitiesService.record({
      userId,
      entityType: 'invoice',
      action: 'deleted',
      entityUuid: uuid,
      student: invoice.student,
      payload: { title: invoice.title, price: invoice.price, totalCount: invoice.totalCount },
    });

    return { success: true };
  }
}
