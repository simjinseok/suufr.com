import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentStatusDto } from './dto/create-student-status.dto';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';

@Injectable()
export class StudentStatusesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByStudent(studentUuid: string, organizationId: number) {
    const student = await this.prisma.student.findUnique({
      where: { uuid: studentUuid },
    });

    if (!student || student.deletedAt) {
      throw new NotFoundException(`Student with UUID ${studentUuid} not found`);
    }

    if (student.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
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

  async create(studentUuid: string, dto: CreateStudentStatusDto, organizationId: number) {
    const student = await this.prisma.student.findUnique({
      where: { uuid: studentUuid },
    });

    if (!student || student.deletedAt) {
      throw new NotFoundException(`Student with UUID ${studentUuid} not found`);
    }

    if (student.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    // Create status history and update student status
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

  async update(uuid: string, dto: UpdateStudentStatusDto, organizationId: number) {
    const status = await this.prisma.studentStatus.findUnique({
      where: { uuid },
      include: { student: true },
    });

    if (!status || status.deletedAt) {
      throw new NotFoundException(`Status with UUID ${uuid} not found`);
    }

    if (status.student.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
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
