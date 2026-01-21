import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentCommentDto } from './dto/create-student-comment.dto';
import { UpdateStudentCommentDto } from './dto/update-student-comment.dto';

@Injectable()
export class StudentCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkMembership(userId: string, organizationId: number) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId, deletedAt: null },
    });
    if (!member) throw new ForbiddenException('Access denied');
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

    const comments = await this.prisma.studentComment.findMany({
      where: {
        studentId: student.id,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: comments };
  }

  async create(studentUuid: string, dto: CreateStudentCommentDto, userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { uuid: studentUuid },
    });

    if (!student || student.deletedAt) {
      throw new NotFoundException(`Student with UUID ${studentUuid} not found`);
    }

    await this.checkMembership(userId, student.organizationId);

    const comment = await this.prisma.studentComment.create({
      data: {
        content: dto.content,
        studentId: student.id,
      },
    });

    return { success: true, data: comment };
  }

  async update(uuid: string, dto: UpdateStudentCommentDto, userId: string) {
    const comment = await this.prisma.studentComment.findUnique({
      where: { uuid },
      include: { student: true },
    });

    if (!comment || comment.deletedAt) {
      throw new NotFoundException(`Comment with UUID ${uuid} not found`);
    }

    await this.checkMembership(userId, comment.student.organizationId);

    const updated = await this.prisma.studentComment.update({
      where: { uuid },
      data: {
        ...(dto.content !== undefined && { content: dto.content }),
      },
    });

    return { success: true, data: updated };
  }

  async remove(uuid: string, userId: string) {
    const comment = await this.prisma.studentComment.findUnique({
      where: { uuid },
      include: { student: true },
    });

    if (!comment || comment.deletedAt) {
      throw new NotFoundException(`Comment with UUID ${uuid} not found`);
    }

    await this.checkMembership(userId, comment.student.organizationId);

    await this.prisma.studentComment.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
