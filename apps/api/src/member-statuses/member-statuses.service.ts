import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemberStatusDto } from './dto/create-member-status.dto';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto';

@Injectable()
export class MemberStatusesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByMember(memberUuid: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { uuid: memberUuid },
      include: {
        organization: {
          include: {
            members: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    if (!member || member.deletedAt) {
      throw new NotFoundException(`Member with UUID ${memberUuid} not found`);
    }

    // Check if user is a member of the same organization
    const isMember = member.organization.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Access denied');
    }

    const statuses = await this.prisma.memberStatus.findMany({
      where: {
        memberId: member.id,
        deletedAt: null,
      },
      orderBy: { changedAt: 'desc' },
    });

    return { success: true, data: statuses };
  }

  async create(memberUuid: string, dto: CreateMemberStatusDto, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { uuid: memberUuid },
      include: {
        organization: {
          include: {
            members: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    if (!member || member.deletedAt) {
      throw new NotFoundException(`Member with UUID ${memberUuid} not found`);
    }

    // Check if user is a member of the organization
    const isMember = member.organization.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Access denied');
    }

    // Create status history and update member status
    const [status] = await this.prisma.$transaction([
      this.prisma.memberStatus.create({
        data: {
          status: dto.status,
          notes: dto.notes,
          changedAt: dto.changedAt ? new Date(dto.changedAt) : new Date(),
          memberId: member.id,
        },
      }),
      this.prisma.organizationMember.update({
        where: { uuid: memberUuid },
        data: { status: dto.status },
      }),
    ]);

    return { success: true, data: status };
  }

  async update(uuid: string, dto: UpdateMemberStatusDto, userId: string) {
    const status = await this.prisma.memberStatus.findUnique({
      where: { uuid },
      include: {
        member: {
          include: {
            organization: {
              include: {
                members: {
                  where: { deletedAt: null },
                },
              },
            },
          },
        },
      },
    });

    if (!status || status.deletedAt) {
      throw new NotFoundException(`Status with UUID ${uuid} not found`);
    }

    // Check if user is a member of the organization
    const isMember = status.member.organization.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.memberStatus.update({
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
