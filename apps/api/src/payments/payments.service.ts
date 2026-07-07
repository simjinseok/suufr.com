import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { Prisma } from '@prisma/generated/client';
import { kstMonthStart, toKstParts } from '../common/utils/kst';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {
      deletedAt: null,
      lesson: {
        deletedAt: null,
        student: {
          deletedAt: null,
          organizationId: { in: orgIds },
        },
      },
    };

    // 날짜 필터링 (KST 기준 월/연 경계, 다음 구간 시작을 exclusive 상한으로 사용)
    if (year !== undefined && month !== undefined) {
      where.paidAt = { gte: kstMonthStart(year, month), lt: kstMonthStart(year, month + 1) };
    }
    else if (year !== undefined) {
      where.paidAt = { gte: kstMonthStart(year, 1), lt: kstMonthStart(year + 1, 1) };
    }

    const [payments, totalCount] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          lesson: {
            include: { student: true },
          },
        },
        orderBy: { paidAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      success: true,
      data: payments,
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
        lesson: {
          deletedAt: null,
          student: { organization: { userId, deletedAt: null } },
        },
      },
      include: {
        lesson: {
          include: { student: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with UUID ${uuid} not found`);
    }

    return { success: true, data: payment };
  }

  async create(dto: CreatePaymentDto, userId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        uuid: dto.lessonUuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
      include: {
        student: true,
        payment: true,
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with UUID ${dto.lessonUuid} not found`);
    }

    if (lesson.payment && !lesson.payment.deletedAt) {
      throw new ConflictException('Payment already exists for this lesson');
    }

    // soft delete된 payment가 있으면 복구 및 업데이트
    if (lesson.payment && lesson.payment.deletedAt) {
      const payment = await this.prisma.payment.update({
        where: { id: lesson.payment.id },
        data: {
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          notes: dto.notes,
          paidAt: new Date(dto.paidAt),
          deletedAt: null,
        },
        include: {
          lesson: {
            include: { student: true },
          },
        },
      });

      return { success: true, data: payment };
    }

    const payment = await this.prisma.payment.create({
      data: {
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        notes: dto.notes,
        paidAt: new Date(dto.paidAt),
        lessonId: lesson.id,
      },
      include: {
        lesson: {
          include: { student: true },
        },
      },
    });

    return { success: true, data: payment };
  }

  async update(uuid: string, dto: UpdatePaymentDto, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        uuid,
        deletedAt: null,
        lesson: {
          deletedAt: null,
          student: { organization: { userId, deletedAt: null } },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with UUID ${uuid} not found`);
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { uuid },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.paymentMethod !== undefined && { paymentMethod: dto.paymentMethod }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.paidAt !== undefined && { paidAt: new Date(dto.paidAt) }),
      },
      include: {
        lesson: {
          include: { student: true },
        },
      },
    });

    return { success: true, data: updatedPayment };
  }

  async remove(uuid: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        uuid,
        deletedAt: null,
        lesson: {
          deletedAt: null,
          student: { organization: { userId, deletedAt: null } },
        },
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

  async getMonthlyTrend(userId: string) {
    const organizations = await this.prisma.organization.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    const orgIds = organizations.map(o => o.id);

    // 최근 12개월 날짜 범위 계산 (KST 기준)
    const { year: currentYear, month: currentMonth } = toKstParts(new Date());
    const startDate = kstMonthStart(currentYear, currentMonth - 11);
    const endDate = kstMonthStart(currentYear, currentMonth + 1); // 다음 달 시작 (exclusive)

    const payments = await this.prisma.payment.findMany({
      where: {
        deletedAt: null,
        paidAt: { gte: startDate, lt: endDate },
        lesson: {
          deletedAt: null,
          student: {
            deletedAt: null,
            organizationId: { in: orgIds },
          },
        },
      },
      select: {
        amount: true,
        paidAt: true,
      },
    });

    // 월별로 그룹핑
    const monthlyMap = new Map<string, { year: number; month: number; totalAmount: number; count: number }>();

    // 12개월 모든 월에 대해 초기화 (데이터 없어도 0으로 표시, KST 기준)
    const baseIndex = currentYear * 12 + (currentMonth - 1);
    for (let i = 0; i < 12; i++) {
      const idx = baseIndex - 11 + i;
      const year = Math.floor(idx / 12);
      const month = (idx % 12) + 1;
      const key = `${year}-${month}`;
      monthlyMap.set(key, { year, month, totalAmount: 0, count: 0 });
    }

    for (const payment of payments) {
      const { year, month } = toKstParts(payment.paidAt);
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
