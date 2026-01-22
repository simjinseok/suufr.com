import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { ListMeetingsQueryDto } from './dto/list-meetings-query.dto';
import { Prisma } from '@prisma/generated/client';

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkMembership(userId: string, organizationId: number) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!member) {
      throw new ForbiddenException('Access denied');
    }

    return member;
  }

  private async getMeetingWithOrganization(uuid: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { uuid },
    });

    if (!meeting || meeting.deletedAt) {
      throw new NotFoundException(`Meeting with UUID ${uuid} not found`);
    }

    return meeting;
  }

  async findAll(query: ListMeetingsQueryDto, userId: string) {
    // 사용자가 속한 모든 organization 조회
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId, deletedAt: null, organization: { deletedAt: null } },
      include: { organization: { select: { id: true, uuid: true } } },
    });
    const userOrgUuids = memberships.map(m => m.organization.uuid);
    const userOrgIds = memberships.map(m => m.organizationId);

    // organizationUuids가 지정되면 사용자가 속한 organization만 필터링
    let orgIds: number[];
    if (query.organizationUuids && query.organizationUuids.length > 0) {
      const filteredUuids = query.organizationUuids.filter(uuid => userOrgUuids.includes(uuid));
      orgIds = memberships
        .filter(m => filteredUuids.includes(m.organization.uuid))
        .map(m => m.organizationId);
    }
    else {
      orgIds = userOrgIds;
    }

    const { page = 1, limit = 20, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.MeetingWhereInput = {
      deletedAt: null,
      organizationId: { in: orgIds },
      ...(dateFrom || dateTo) && {
        meetingAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      },
    };

    const [meetings, totalCount] = await Promise.all([
      this.prisma.meeting.findMany({
        where,
        orderBy: { meetingAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.meeting.count({ where }),
    ]);

    return {
      success: true,
      data: meetings,
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async findOne(uuid: string, userId: string) {
    const meeting = await this.getMeetingWithOrganization(uuid);
    await this.checkMembership(userId, meeting.organizationId);

    return { success: true, data: meeting };
  }

  async create(dto: CreateMeetingDto, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { uuid: dto.organizationUuid },
    });

    if (!organization || organization.deletedAt) {
      throw new NotFoundException('Organization not found');
    }

    await this.checkMembership(userId, organization.id);

    const meeting = await this.prisma.meeting.create({
      data: {
        name: dto.name,
        notes: dto.notes,
        meetingAt: new Date(dto.meetingAt),
        phone: dto.phone,
        isDone: dto.isDone ?? false,
        organizationId: organization.id,
        userId,
      },
    });

    return { success: true, data: meeting };
  }

  async update(uuid: string, dto: UpdateMeetingDto, userId: string) {
    const meeting = await this.getMeetingWithOrganization(uuid);
    await this.checkMembership(userId, meeting.organizationId);

    const updatedMeeting = await this.prisma.meeting.update({
      where: { uuid },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.meetingAt !== undefined && { meetingAt: new Date(dto.meetingAt) }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.isDone !== undefined && { isDone: dto.isDone }),
      },
    });

    return { success: true, data: updatedMeeting };
  }

  async remove(uuid: string, userId: string) {
    const meeting = await this.getMeetingWithOrganization(uuid);
    await this.checkMembership(userId, meeting.organizationId);

    await this.prisma.meeting.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
