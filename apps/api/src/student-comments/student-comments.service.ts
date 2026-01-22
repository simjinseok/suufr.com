import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentCommentDto } from './dto/create-student-comment.dto';
import { UpdateStudentCommentDto } from './dto/update-student-comment.dto';

@Injectable()
export class StudentCommentsService {
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

    const comment = await this.prisma.studentComment.create({
      data: {
        content: dto.content,
        studentId: student.id,
      },
    });

    return { success: true, data: comment };
  }

  async update(uuid: string, dto: UpdateStudentCommentDto, userId: string) {
    const comment = await this.prisma.studentComment.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: {
          deletedAt: null,
          organization: { userId, deletedAt: null },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with UUID ${uuid} not found`);
    }

    const updated = await this.prisma.studentComment.update({
      where: { uuid },
      data: {
        ...(dto.content !== undefined && { content: dto.content }),
      },
    });

    return { success: true, data: updated };
  }

  async remove(uuid: string, userId: string) {
    const comment = await this.prisma.studentComment.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: {
          deletedAt: null,
          organization: { userId, deletedAt: null },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with UUID ${uuid} not found`);
    }

    await this.prisma.studentComment.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
