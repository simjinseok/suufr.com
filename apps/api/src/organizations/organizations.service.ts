import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileImageService, ProfileImageChange } from '../s3/profile-image.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileImageService: ProfileImageService,
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

    // profileImageUrl / logoImageUrl 커밋 (검증 + pending 태그 제거).
    // 한쪽 커밋 뒤 이후 단계가 실패하면 커밋된 신규 객체를 정리해 고아를 남기지 않는다
    const profileChange = await this.profileImageService.commitChange(
      userId,
      dto.profileImageUrl,
      organization.profileImageUrl,
    );

    let logoChange: ProfileImageChange;
    try {
      logoChange = await this.profileImageService.commitChange(
        userId,
        dto.logoImageUrl,
        organization.logoImageUrl,
      );
    }
    catch (error) {
      this.profileImageService.scheduleDeletion(profileChange.url);
      throw error;
    }

    let updated;
    try {
      updated = await this.prisma.organization.update({
        where: { uuid },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.profileName !== undefined && { profileName: dto.profileName }),
          ...(profileChange.url !== undefined && { profileImageUrl: profileChange.url }),
          ...(logoChange.url !== undefined && { logoImageUrl: logoChange.url }),
        },
      });
    }
    catch (error) {
      this.profileImageService.scheduleDeletion(profileChange.url);
      this.profileImageService.scheduleDeletion(logoChange.url);
      throw error;
    }

    // 기존 이미지 삭제 (response 후 비동기로 처리)
    this.profileImageService.scheduleDeletion(profileChange.previousUrlToDelete);
    this.profileImageService.scheduleDeletion(logoChange.previousUrlToDelete);

    return { success: true, data: updated };
  }
}
