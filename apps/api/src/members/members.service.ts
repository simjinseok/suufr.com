import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByOrganization(organizationUuid: string, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { uuid: organizationUuid },
      include: {
        members: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!organization || organization.deletedAt) {
      throw new NotFoundException(`Organization with UUID ${organizationUuid} not found`);
    }

    // Check if user is a member
    const isMember = organization.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Access denied');
    }

    return { success: true, data: organization.members };
  }

  async create(organizationUuid: string, dto: CreateMemberDto, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { uuid: organizationUuid },
      include: {
        members: {
          where: { deletedAt: null },
        },
      },
    });

    if (!organization || organization.deletedAt) {
      throw new NotFoundException(`Organization with UUID ${organizationUuid} not found`);
    }

    // Check if user is owner
    const ownerMember = organization.members.find((m) => m.userId === userId && m.role === 'owner');
    if (!ownerMember) {
      throw new ForbiddenException('Only owner can add members');
    }

    // Check for duplicate name
    const existingMember = organization.members.find((m) => m.name === dto.name);
    if (existingMember) {
      throw new ConflictException('Member with this name already exists');
    }

    const member = await this.prisma.organizationMember.create({
      data: {
        name: dto.name,
        role: dto.role ?? 'teacher',
        organizationId: organization.id,
      },
    });

    return { success: true, data: member };
  }

  async findOne(uuid: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { uuid },
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
      throw new NotFoundException(`Member with UUID ${uuid} not found`);
    }

    // Check if user is a member of the same organization
    const isMember = member.organization.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Access denied');
    }

    return { success: true, data: member };
  }

  async update(uuid: string, dto: UpdateMemberDto, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { uuid },
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
      throw new NotFoundException(`Member with UUID ${uuid} not found`);
    }

    // Check if user is owner of the organization
    const ownerMember = member.organization.members.find((m) => m.userId === userId && m.role === 'owner');
    if (!ownerMember) {
      throw new ForbiddenException('Only owner can update members');
    }

    // Check for duplicate name if changing
    if (dto.name && dto.name !== member.name) {
      const existingMember = member.organization.members.find((m) => m.name === dto.name);
      if (existingMember) {
        throw new ConflictException('Member with this name already exists');
      }
    }

    const updated = await this.prisma.organizationMember.update({
      where: { uuid },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role }),
      },
    });

    return { success: true, data: updated };
  }

  async remove(uuid: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { uuid },
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
      throw new NotFoundException(`Member with UUID ${uuid} not found`);
    }

    // Check if user is owner of the organization
    const ownerMember = member.organization.members.find((m) => m.userId === userId && m.role === 'owner');
    if (!ownerMember) {
      throw new ForbiddenException('Only owner can remove members');
    }

    // Cannot remove self
    if (member.userId === userId) {
      throw new ForbiddenException('Cannot remove yourself');
    }

    await this.prisma.organizationMember.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
