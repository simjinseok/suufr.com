import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { Prisma } from '@prisma/generated/client';

@Injectable()
export class PaymentsService {
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

  private async getPaymentWithOrganization(uuid: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { uuid },
      include: {
        lesson: {
          include: { student: { select: { organizationId: true } } },
        },
      },
    });

    if (!payment || payment.deletedAt) {
      throw new NotFoundException(`Payment with UUID ${uuid} not found`);
    }

    return payment;
  }

  async findAll(query: ListPaymentsQueryDto, userId: string) {
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
    } else if (year !== undefined) {
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
    const payment = await this.getPaymentWithOrganization(uuid);
    await this.checkMembership(userId, payment.lesson.student.organizationId);

    const fullPayment = await this.prisma.payment.findUnique({
      where: { uuid },
      include: {
        lesson: {
          include: { student: true },
        },
      },
    });

    return { success: true, data: fullPayment };
  }

  async create(dto: CreatePaymentDto, userId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { uuid: dto.lessonUuid },
      include: {
        student: true,
        payment: true,
      },
    });

    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException(`Lesson with UUID ${dto.lessonUuid} not found`);
    }

    await this.checkOwnership(userId, lesson.student.organizationId);

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
    const payment = await this.getPaymentWithOrganization(uuid);
    await this.checkOwnership(userId, payment.lesson.student.organizationId);

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
    const payment = await this.getPaymentWithOrganization(uuid);
    await this.checkOwnership(userId, payment.lesson.student.organizationId);

    await this.prisma.payment.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
