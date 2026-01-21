import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentStatusDto } from './dto/create-student-status.dto';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';

@Injectable()
export class StudentStatusesService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkMembership(userId: string, organizationId: number) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId, deletedAt: null },
    });
    if (!member) throw new ForbiddenException('Access denied');
    return member;
  }

  private async checkOwnership(userId: string, organizationId: number) {
    const member = await this.checkMembership(userId, organizationId);
    if (member.role !== 'owner') throw new ForbiddenException('Owner permission required');
    return member;
  }

  async findByStudent(studentUuid: string, userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { uuid: studentUuid },
    });

    if (!student || student.deletedAt) {
      throw new NotFoundException(`Student with UUID ${studentUuid} not found`);
    }

    await this.checkMembership(userId, student.organizationId);

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
    const student = await this.prisma.student.findUnique({
      where: { uuid: studentUuid },
    });

    if (!student || student.deletedAt) {
      throw new NotFoundException(`Student with UUID ${studentUuid} not found`);
    }

    await this.checkOwnership(userId, student.organizationId);

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
    const status = await this.prisma.studentStatus.findUnique({
      where: { uuid },
      include: { student: true },
    });

    if (!status || status.deletedAt) {
      throw new NotFoundException(`Status with UUID ${uuid} not found`);
    }

    await this.checkOwnership(userId, status.student.organizationId);

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
