import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: number) {
    const students = await this.prisma.student.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: students };
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
      },
    });

    return { success: true, data: student };
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
}
