import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentStatusDto } from './dto/create-student-status.dto';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';

@Injectable()
export class StudentStatusesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByStudent(studentUuid: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        uuid: studentUuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with UUID ${studentUuid} not found`);
    }

    const statuses = await this.prisma.studentStatus.findMany({
      where: {
        studentId: student.id,
        deletedAt: null,
      },
      orderBy: { changedAt: 'desc' },
    });

    return { success: true, data: statuses };
  }

  async create(studentUuid: string, dto: CreateStudentStatusDto, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        uuid: studentUuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with UUID ${studentUuid} not found`);
    }

    const [status] = await this.prisma.$transaction([
      this.prisma.studentStatus.create({
        data: {
          status: dto.status,
          notes: dto.notes,
          changedAt: dto.changedAt ? new Date(dto.changedAt) : new Date(),
          studentId: student.id,
        },
      }),
      this.prisma.student.update({
        where: { uuid: studentUuid },
        data: { status: dto.status },
      }),
    ]);

    return { success: true, data: status };
  }

  async update(uuid: string, dto: UpdateStudentStatusDto, userId: string) {
    const status = await this.prisma.studentStatus.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: {
          deletedAt: null,
          organization: { userId, deletedAt: null },
        },
      },
    });

    if (!status) {
      throw new NotFoundException(`Status with UUID ${uuid} not found`);
    }

    const updated = await this.prisma.studentStatus.update({
      where: { uuid },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.changedAt !== undefined && { changedAt: new Date(dto.changedAt) }),
      },
    });

    return { success: true, data: updated };
  }
}
