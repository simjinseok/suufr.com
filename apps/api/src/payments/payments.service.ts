import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { Prisma } from '@prisma/generated/client';

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

    // 날짜 필터링
    if (year !== undefined && month !== undefined) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      where.paidAt = { gte: startDate, lte: endDate };
    }
    else if (year !== undefined) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      where.paidAt = { gte: startDate, lte: endDate };
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
}
