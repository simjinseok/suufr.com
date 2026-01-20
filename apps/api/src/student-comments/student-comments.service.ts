import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentCommentDto } from './dto/create-student-comment.dto';
import { UpdateStudentCommentDto } from './dto/update-student-comment.dto';

@Injectable()
export class StudentCommentsService {
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

    const comments = await this.prisma.studentComment.findMany({
      where: {
        studentId: student.id,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: comments };
  }

  async create(studentUuid: string, dto: CreateStudentCommentDto, organizationId: number) {
    const student = await this.prisma.student.findUnique({
      where: { uuid: studentUuid },
    });

    if (!student || student.deletedAt) {
      throw new NotFoundException(`Student with UUID ${studentUuid} not found`);
    }

    if (student.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    const comment = await this.prisma.studentComment.create({
      data: {
        content: dto.content,
        studentId: student.id,
      },
    });

    return { success: true, data: comment };
  }

  async update(uuid: string, dto: UpdateStudentCommentDto, organizationId: number) {
    const comment = await this.prisma.studentComment.findUnique({
      where: { uuid },
      include: { student: true },
    });

    if (!comment || comment.deletedAt) {
      throw new NotFoundException(`Comment with UUID ${uuid} not found`);
    }

    if (comment.student.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.studentComment.update({
      where: { uuid },
      data: {
        ...(dto.content !== undefined && { content: dto.content }),
      },
    });

    return { success: true, data: updated };
  }

  async remove(uuid: string, organizationId: number) {
    const comment = await this.prisma.studentComment.findUnique({
      where: { uuid },
      include: { student: true },
    });

    if (!comment || comment.deletedAt) {
      throw new NotFoundException(`Comment with UUID ${uuid} not found`);
    }

    if (comment.student.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.studentComment.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
