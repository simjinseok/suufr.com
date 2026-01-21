import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

function generateShareId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId?: number, memberId?: number) {
    const lessons = await this.prisma.lesson.findMany({
      where: {
        deletedAt: null,
        ...(memberId && { memberId }),
        student: {
          deletedAt: null,
          ...(organizationId && { organizationId }),
        },
      },
      include: {
        student: true,
        sessions: {
          where: { deletedAt: null },
          orderBy: { sessionAt: 'asc' },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: lessons };
  }

  async findOne(uuid: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { uuid },
      include: {
        student: true,
        sessions: {
          where: { deletedAt: null },
          orderBy: { sessionAt: 'asc' },
          include: { feedback: true },
        },
        payment: true,
        shares: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException(`Lesson with UUID ${uuid} not found`);
    }

    return { success: true, data: lesson };
  }

  async create(dto: CreateLessonDto, organizationId: number, memberId: number) {
    const student = await this.prisma.student.findUnique({
      where: { uuid: dto.studentUuid },
    });

    if (!student || student.deletedAt) {
      throw new NotFoundException(`Student with UUID ${dto.studentUuid} not found`);
    }

    const lesson = await this.prisma.lesson.create({
      data: {
        title: dto.title,
        notes: dto.notes ?? '',
        studentId: student.id,
        memberId,
        sessions: dto.sessions
          ? {
              create: dto.sessions.map((s) => ({
                sessionAt: new Date(s.sessionAt),
                duration: s.duration ?? 60,
                notes: s.notes ?? '',
              })),
            }
          : undefined,
      },
      include: {
        student: true,
        sessions: {
          where: { deletedAt: null },
          orderBy: { sessionAt: 'asc' },
        },
      },
    });

    return { success: true, data: lesson };
  }

  async update(uuid: string, dto: UpdateLessonDto) {
    const existing = await this.prisma.lesson.findUnique({
      where: { uuid },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Lesson with UUID ${uuid} not found`);
    }

    const lesson = await this.prisma.lesson.update({
      where: { uuid },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        student: true,
        sessions: {
          where: { deletedAt: null },
          orderBy: { sessionAt: 'asc' },
        },
        payment: true,
      },
    });

    return { success: true, data: lesson };
  }

  async remove(uuid: string) {
    const existing = await this.prisma.lesson.findUnique({
      where: { uuid },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Lesson with UUID ${uuid} not found`);
    }

    await this.prisma.lesson.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async createShare(uuid: string, expiresInDays = 7) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { uuid },
    });

    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException(`Lesson with UUID ${uuid} not found`);
    }

    const shareId = generateShareId();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const share = await this.prisma.sessionShare.create({
      data: {
        shareId,
        lessonId: lesson.id,
        expiresAt,
      },
    });

    return { success: true, data: { shareId: share.shareId, expiresAt: share.expiresAt } };
  }

  async getByShareId(shareId: string) {
    const share = await this.prisma.sessionShare.findUnique({
      where: { shareId },
      include: {
        lesson: {
          include: {
            student: true,
            sessions: {
              where: { deletedAt: null },
              orderBy: { sessionAt: 'asc' },
              include: { feedback: true },
            },
          },
        },
      },
    });

    if (!share || share.deletedAt) {
      throw new NotFoundException('Share link not found');
    }

    if (share.expiresAt < new Date()) {
      throw new ForbiddenException('Share link has expired');
    }

    if (share.lesson.deletedAt) {
      throw new NotFoundException('Lesson not found');
    }

    return { success: true, data: share.lesson };
  }
}
