import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: number, memberId: number, year?: number, month?: number) {
    const whereClause: Record<string, unknown> = {
      deletedAt: null,
      lesson: {
        memberId,
        deletedAt: null,
        student: {
          organizationId,
          deletedAt: null,
        },
      },
    };

    if (year !== undefined && month !== undefined) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      whereClause.paidAt = {
        gte: startDate,
        lte: endDate,
      };
    }
    else if (year !== undefined) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      whereClause.paidAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    const payments = await this.prisma.payment.findMany({
      where: whereClause,
      include: {
        lesson: {
          include: { student: true },
        },
      },
      orderBy: { paidAt: 'desc' },
    });

    return { success: true, data: payments };
  }

  async findOne(uuid: string, organizationId: number, memberId: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { uuid },
      include: {
        lesson: {
          include: { student: true },
        },
      },
    });

    if (!payment || payment.deletedAt) {
      throw new NotFoundException(`Payment with UUID ${uuid} not found`);
    }

    if (payment.lesson.student.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    if (payment.lesson.memberId !== memberId) {
      throw new ForbiddenException('Access denied');
    }

    return { success: true, data: payment };
  }

  async create(dto: CreatePaymentDto, organizationId: number, memberId: number) {
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

    if (lesson.student.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    if (lesson.memberId !== memberId) {
      throw new ForbiddenException('Access denied');
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

  async update(uuid: string, dto: UpdatePaymentDto, organizationId: number, memberId: number) {
    const existing = await this.prisma.payment.findUnique({
      where: { uuid },
      include: {
        lesson: {
          include: { student: true },
        },
      },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Payment with UUID ${uuid} not found`);
    }

    if (existing.lesson.student.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    if (existing.lesson.memberId !== memberId) {
      throw new ForbiddenException('Access denied');
    }

    const payment = await this.prisma.payment.update({
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

    return { success: true, data: payment };
  }

  async remove(uuid: string, organizationId: number, memberId: number) {
    const existing = await this.prisma.payment.findUnique({
      where: { uuid },
      include: {
        lesson: {
          include: { student: true },
        },
      },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Payment with UUID ${uuid} not found`);
    }

    if (existing.lesson.student.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    if (existing.lesson.memberId !== memberId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.payment.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
