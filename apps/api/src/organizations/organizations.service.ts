import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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

    // profileImageUrl 처리
    let finalProfileImageUrl: string | null | undefined = undefined;
    let oldProfileImageUrl: string | null = null;

    if (dto.profileImageUrl !== undefined) {
      if (dto.profileImageUrl && dto.profileImageUrl.includes('suufr/temp/')) {
        // temp에서 images로 이동 (200x200 크롭 적용)
        finalProfileImageUrl = await this.cloudinaryService.moveProfileImage(dto.profileImageUrl);
        oldProfileImageUrl = organization.profileImageUrl;
      }
      else if (dto.profileImageUrl === null || dto.profileImageUrl === '') {
        finalProfileImageUrl = null;
        oldProfileImageUrl = organization.profileImageUrl;
      }
      else {
        finalProfileImageUrl = dto.profileImageUrl;
      }
    }

    // logoImageUrl 처리
    let finalLogoImageUrl: string | null | undefined = undefined;
    let oldLogoImageUrl: string | null = null;

    if (dto.logoImageUrl !== undefined) {
      if (dto.logoImageUrl && dto.logoImageUrl.includes('suufr/temp/')) {
        // temp에서 images로 이동 (원본 유지)
        finalLogoImageUrl = await this.cloudinaryService.moveLogoImage(dto.logoImageUrl);
        oldLogoImageUrl = organization.logoImageUrl;
      }
      else if (dto.logoImageUrl === null || dto.logoImageUrl === '') {
        finalLogoImageUrl = null;
        oldLogoImageUrl = organization.logoImageUrl;
      }
      else {
        finalLogoImageUrl = dto.logoImageUrl;
      }
    }

    const updated = await this.prisma.organization.update({
      where: { uuid },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.profileName !== undefined && { profileName: dto.profileName }),
        ...(finalProfileImageUrl !== undefined && { profileImageUrl: finalProfileImageUrl }),
        ...(finalLogoImageUrl !== undefined && { logoImageUrl: finalLogoImageUrl }),
      },
    });

    // 기존 이미지 삭제 (response 후 비동기로 처리)
    if (oldProfileImageUrl) {
      setImmediate(() => {
        this.cloudinaryService.deleteByUrl(oldProfileImageUrl).catch((err) => {
          console.error('Failed to delete old profile image:', err);
        });
      });
    }
    if (oldLogoImageUrl) {
      setImmediate(() => {
        this.cloudinaryService.deleteByUrl(oldLogoImageUrl).catch((err) => {
          console.error('Failed to delete old logo image:', err);
        });
      });
    }

    return { success: true, data: updated };
  }
}
