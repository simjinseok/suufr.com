import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { Prisma } from '@prisma/generated/client';
import { zonedMonthStart, zonedParts } from '../common/utils/timezone';
import { SettingsService } from '../settings/settings.service';

// 목록/상세 공통 include — 매출 화면이 학생 단위 그룹핑에 student를 사용
// invoicePayments는 §6-22 순수 연결 표시용 — 납부 상태 파생은 여전히 학생 단위 잔액
const PAYMENT_INCLUDE = {
  student: true,
  invoicePayments: {
    where: { invoice: { deletedAt: null } },
    include: { invoice: { select: { uuid: true, title: true } } },
  },
} satisfies Prisma.PaymentInclude;

type PaymentWithInclude = Prisma.PaymentGetPayload<{ include: typeof PAYMENT_INCLUDE }>;

// 응답에서 조인 행을 감추고 연결된 수강권만 평탄화해 노출
function serialize({ invoicePayments, ...payment }: PaymentWithInclude) {
  return { ...payment, invoices: invoicePayments.map(ip => ip.invoice) };
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async findAll(query: ListPaymentsQueryDto, userId: string) {
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

    const { page = 1, limit = 20, year, month } = query;
    const timezone = await this.settingsService.resolveTimezone(userId, query.timezone);
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {
      deletedAt: null,
      student: {
        deletedAt: null,
        organizationId: { in: orgIds },
        ...(query.studentUuid && { uuid: query.studentUuid }),
      },
    };

    // 날짜 필터링 (요청 타임존 기준 월/연 경계, 다음 구간 시작을 exclusive 상한으로 사용)
    if (year !== undefined && month !== undefined) {
      where.paidAt = { gte: zonedMonthStart(year, month, timezone), lt: zonedMonthStart(year, month + 1, timezone) };
    }
    else if (year !== undefined) {
      where.paidAt = { gte: zonedMonthStart(year, 1, timezone), lt: zonedMonthStart(year + 1, 1, timezone) };
    }

    const [payments, totalCount] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: PAYMENT_INCLUDE,
        orderBy: { paidAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      success: true,
      data: payments.map(serialize),
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async findOne(uuid: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
      include: PAYMENT_INCLUDE,
    });

    if (!payment) {
      throw new NotFoundException(`Payment with UUID ${uuid} not found`);
    }

    return { success: true, data: serialize(payment) };
  }

  // 연결 대상 수강권 검증 — 같은 학생 소유·미삭제만 허용 (invoices.service의 세션 귀속 검증 미러)
  private async resolveInvoiceIds(invoiceUuids: string[], studentId: number) {
    const uuids = [...new Set(invoiceUuids)];
    if (uuids.length === 0) return [];

    const invoices = await this.prisma.invoice.findMany({
      where: { uuid: { in: uuids }, studentId, deletedAt: null },
      select: { id: true },
    });

    if (invoices.length !== uuids.length) {
      throw new BadRequestException('일부 수강권을 찾을 수 없거나 이 학생의 수강권이 아닙니다.');
    }

    return invoices.map(i => i.id);
  }

  async create(dto: CreatePaymentDto, userId: string) {
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

    const invoiceIds = dto.invoiceUuids?.length
      ? await this.resolveInvoiceIds(dto.invoiceUuids, student.id)
      : [];

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          amount: dto.amount,
          method: dto.method,
          notes: dto.notes,
          paidAt: new Date(dto.paidAt),
          studentId: student.id,
        },
      });

      if (invoiceIds.length > 0) {
        await tx.invoicePayment.createMany({
          data: invoiceIds.map(invoiceId => ({ invoiceId, paymentId: created.id })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    const full = await this.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: PAYMENT_INCLUDE,
    });

    return { success: true, data: serialize(full) };
  }

  async update(uuid: string, dto: UpdatePaymentDto, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with UUID ${uuid} not found`);
    }

    // set 의미론: undefined = 연결 불변, [] = 전부 해제 (§6-22)
    const nextInvoiceIds = dto.invoiceUuids !== undefined
      ? await this.resolveInvoiceIds(dto.invoiceUuids, payment.studentId)
      : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { uuid },
        data: {
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.method !== undefined && { method: dto.method }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.paidAt !== undefined && { paidAt: new Date(dto.paidAt) }),
        },
      });

      if (nextInvoiceIds !== undefined) {
        await tx.invoicePayment.deleteMany({ where: { paymentId: payment.id } });
        if (nextInvoiceIds.length > 0) {
          await tx.invoicePayment.createMany({
            data: nextInvoiceIds.map(invoiceId => ({ invoiceId, paymentId: payment.id })),
            skipDuplicates: true,
          });
        }
      }
    });

    const full = await this.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: PAYMENT_INCLUDE,
    });

    return { success: true, data: serialize(full) };
  }

  async remove(uuid: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with UUID ${uuid} not found`);
    }

    await this.prisma.payment.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async getMonthlyTrend(userId: string, explicitTimezone?: string) {
    const timezone = await this.settingsService.resolveTimezone(userId, explicitTimezone);
    const organizations = await this.prisma.organization.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    const orgIds = organizations.map(o => o.id);

    // 최근 12개월 날짜 범위 계산 (요청 타임존 기준)
    const { year: currentYear, month: currentMonth } = zonedParts(new Date(), timezone);
    const startDate = zonedMonthStart(currentYear, currentMonth - 11, timezone);
    const endDate = zonedMonthStart(currentYear, currentMonth + 1, timezone); // 다음 달 시작 (exclusive)

    const payments = await this.prisma.payment.findMany({
      where: {
        deletedAt: null,
        paidAt: { gte: startDate, lt: endDate },
        student: {
          deletedAt: null,
          organizationId: { in: orgIds },
        },
      },
      select: {
        amount: true,
        paidAt: true,
      },
    });

    // 월별로 그룹핑
    const monthlyMap = new Map<string, { year: number; month: number; totalAmount: number; count: number }>();

    // 12개월 모든 월에 대해 초기화 (데이터 없어도 0으로 표시, 요청 타임존 기준)
    const baseIndex = currentYear * 12 + (currentMonth - 1);
    for (let i = 0; i < 12; i++) {
      const idx = baseIndex - 11 + i;
      const year = Math.floor(idx / 12);
      const month = (idx % 12) + 1;
      const key = `${year}-${month}`;
      monthlyMap.set(key, { year, month, totalAmount: 0, count: 0 });
    }

    for (const payment of payments) {
      const { year, month } = zonedParts(payment.paidAt, timezone);
      const key = `${year}-${month}`;
      const entry = monthlyMap.get(key);
      if (entry) {
        entry.totalAmount += payment.amount;
        entry.count += 1;
      }
    }

    // 오래된 순으로 정렬
    const months = Array.from(monthlyMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    return {
      success: true,
      data: { months },
    };
  }
}
