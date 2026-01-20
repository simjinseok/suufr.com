import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: number) {
    const meetings = await this.prisma.meeting.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: { meetingAt: 'desc' },
    });

    return { success: true, data: meetings };
  }

  async findOne(uuid: string, organizationId: number) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { uuid },
    });

    if (!meeting || meeting.deletedAt) {
      throw new NotFoundException(`Meeting with UUID ${uuid} not found`);
    }

    if (meeting.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    return { success: true, data: meeting };
  }

  async create(dto: CreateMeetingDto, organizationId: number, userId: string) {
    const meeting = await this.prisma.meeting.create({
      data: {
        name: dto.name,
        notes: dto.notes,
        meetingAt: new Date(dto.meetingAt),
        phone: dto.phone,
        isDone: dto.isDone ?? false,
        organizationId,
        userId,
      },
    });

    return { success: true, data: meeting };
  }

  async update(uuid: string, dto: UpdateMeetingDto, organizationId: number) {
    const existing = await this.prisma.meeting.findUnique({
      where: { uuid },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Meeting with UUID ${uuid} not found`);
    }

    if (existing.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    const meeting = await this.prisma.meeting.update({
      where: { uuid },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.meetingAt !== undefined && { meetingAt: new Date(dto.meetingAt) }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.isDone !== undefined && { isDone: dto.isDone }),
      },
    });

    return { success: true, data: meeting };
  }

  async remove(uuid: string, organizationId: number) {
    const existing = await this.prisma.meeting.findUnique({
      where: { uuid },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Meeting with UUID ${uuid} not found`);
    }

    if (existing.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.meeting.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
