import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        deletedAt: null,
        organization: {
          deletedAt: null,
        },
      },
      include: {
        organization: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const organizations = members.map((m) => ({
      ...m.organization,
      role: m.role,
    }));

    return { success: true, data: organizations };
  }

  async findOne(uuid: string, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { uuid },
      include: {
        members: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!organization || organization.deletedAt) {
      throw new NotFoundException(`Organization with UUID ${uuid} not found`);
    }

    // Check if user is a member
    const isMember = organization.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Access denied');
    }

    return { success: true, data: organization };
  }

  async update(uuid: string, dto: UpdateOrganizationDto, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { uuid },
      include: {
        members: {
          where: { deletedAt: null },
        },
      },
    });

    if (!organization || organization.deletedAt) {
      throw new NotFoundException(`Organization with UUID ${uuid} not found`);
    }

    // Check if user is owner
    const ownerMember = organization.members.find((m) => m.userId === userId && m.role === 'owner');
    if (!ownerMember) {
      throw new ForbiddenException('Only owner can update organization');
    }

    const updated = await this.prisma.organization.update({
      where: { uuid },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
      },
    });

    return { success: true, data: updated };
  }

  async switchOrganization(uuid: string, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { uuid },
      include: {
        members: {
          where: { deletedAt: null },
        },
      },
    });

    if (!organization || organization.deletedAt) {
      throw new NotFoundException(`Organization with UUID ${uuid} not found`);
    }

    // Check if user is a member
    const member = organization.members.find((m) => m.userId === userId);
    if (!member) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.userSettings.upsert({
      where: { userId },
      update: { currentOrganizationId: organization.id },
      create: {
        userId,
        currentOrganizationId: organization.id,
      },
    });

    return {
      success: true,
      data: {
        organization,
        member,
      },
    };
  }
}
