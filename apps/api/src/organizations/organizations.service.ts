import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const organizations = await this.prisma.organization.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    return { success: true, data: organizations };
  }

  async findOne(uuid: string, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { uuid },
    });

    if (!organization || organization.deletedAt) {
      throw new NotFoundException(`Organization with UUID ${uuid} not found`);
    }

    // Check if user is the owner
    if (organization.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return { success: true, data: organization };
  }

  async update(uuid: string, dto: UpdateOrganizationDto, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { uuid },
    });

    if (!organization || organization.deletedAt) {
      throw new NotFoundException(`Organization with UUID ${uuid} not found`);
    }

    // Check if user is the owner
    if (organization.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.organization.update({
      where: { uuid },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.profileName !== undefined && { profileName: dto.profileName }),
        ...(dto.profileImageKey !== undefined && { profileImageKey: dto.profileImageKey }),
      },
    });

    return { success: true, data: updated };
  }

}
