import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { UpsertFeedbackDto } from './dto/feedback.dto';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId?: number, memberId?: number) {
    const sessions = await this.prisma.session.findMany({
      where: {
        deletedAt: null,
        lesson: {
          deletedAt: null,
          ...(memberId && { memberId }),
          student: {
            deletedAt: null,
            ...(organizationId && { organizationId }),
          },
        },
      },
      include: {
        lesson: {
          include: { student: true },
        },
        feedback: true,
      },
      orderBy: { sessionAt: 'asc' },
    });

    return { success: true, data: sessions };
  }

  async findOne(uuid: string) {
    const session = await this.prisma.session.findUnique({
      where: { uuid },
      include: {
        lesson: {
          include: { student: true },
        },
        feedback: true,
      },
    });

    if (!session || session.deletedAt) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    return { success: true, data: session };
  }

  async create(dto: CreateSessionDto, organizationId: number, memberId: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { uuid: dto.lessonUuid },
    });

    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException(`Lesson with UUID ${dto.lessonUuid} not found`);
    }

    const session = await this.prisma.session.create({
      data: {
        sessionAt: new Date(dto.sessionAt),
        duration: dto.duration ?? 60,
        notes: dto.notes ?? '',
        lessonId: lesson.id,
      },
      include: {
        lesson: {
          include: { student: true },
        },
        feedback: true,
      },
    });

    return { success: true, data: session };
  }

  async update(uuid: string, dto: UpdateSessionDto) {
    const existing = await this.prisma.session.findUnique({
      where: { uuid },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    const session = await this.prisma.session.update({
      where: { uuid },
      data: {
        ...(dto.sessionAt !== undefined && { sessionAt: new Date(dto.sessionAt) }),
        ...(dto.duration !== undefined && { duration: dto.duration }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isDone !== undefined && { isDone: dto.isDone }),
      },
      include: {
        lesson: {
          include: { student: true },
        },
        feedback: true,
      },
    });

    return { success: true, data: session };
  }

  async remove(uuid: string) {
    const existing = await this.prisma.session.findUnique({
      where: { uuid },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    await this.prisma.session.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async markDone(uuid: string, isDone: boolean) {
    const existing = await this.prisma.session.findUnique({
      where: { uuid },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    const session = await this.prisma.session.update({
      where: { uuid },
      data: { isDone },
      include: {
        lesson: {
          include: { student: true },
        },
        feedback: true,
      },
    });

    return { success: true, data: session };
  }

  async upsertFeedback(uuid: string, dto: UpsertFeedbackDto) {
    const session = await this.prisma.session.findUnique({
      where: { uuid },
      include: { feedback: true },
    });

    if (!session || session.deletedAt) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    let feedback;
    if (session.feedback) {
      feedback = await this.prisma.feedback.update({
        where: { id: session.feedback.id },
        data: { notes: dto.notes },
      });
    }
    else {
      feedback = await this.prisma.feedback.create({
        data: {
          notes: dto.notes,
          sessionId: session.id,
        },
      });
    }

    return { success: true, data: feedback };
  }

  async deleteFeedback(uuid: string) {
    const session = await this.prisma.session.findUnique({
      where: { uuid },
      include: { feedback: true },
    });

    if (!session || session.deletedAt) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    if (!session.feedback) {
      throw new NotFoundException('Feedback not found');
    }

    await this.prisma.feedback.update({
      where: { id: session.feedback.id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
