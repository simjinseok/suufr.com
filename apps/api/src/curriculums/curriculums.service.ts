import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { StorageQuotaService } from '../storage/storage-quota.service';
import {
  CreateCurriculumDto,
  UpdateCurriculumDto,
  CreateCurriculumItemDto,
  UpdateCurriculumItemDto,
  CreateMediaFileDto,
} from './dto';

const MAX_MEDIA_FILES_PER_ITEM = 5;

@Injectable()
export class CurriculumsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly storageQuotaService: StorageQuotaService,
  ) {}

  async findAll(userId: string, search?: string) {
    // 사용자가 소유한 모든 organization 조회
    const organizations = await this.prisma.organization.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    const orgIds = organizations.map(o => o.id);

    const curriculums = await this.prisma.curriculum.findMany({
      where: {
        organizationId: { in: orgIds },
        deletedAt: null,
        ...(search && {
          title: { contains: search, mode: 'insensitive' },
        }),
      },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { title: 'asc' },
          include: {
            mediaFiles: {
              orderBy: { createdAt: 'asc' },
              include: { mediaFile: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: curriculums };
  }

  async findOne(uuid: string, userId: string) {
    const curriculum = await this.prisma.curriculum.findFirst({
      where: {
        uuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { title: 'asc' },
          include: {
            mediaFiles: {
              orderBy: { createdAt: 'asc' },
              include: { mediaFile: true },
            },
          },
        },
      },
    });

    if (!curriculum) {
      throw new NotFoundException(`Curriculum with UUID ${uuid} not found`);
    }

    return { success: true, data: curriculum };
  }

  async create(dto: CreateCurriculumDto, userId: string) {
    // 사용자의 organization 조회
    const organization = await this.prisma.organization.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const curriculum = await this.prisma.curriculum.create({
      data: {
        title: dto.title,
        description: dto.description,
        organizationId: organization.id,
      },
    });

    return this.findOne(curriculum.uuid, userId);
  }

  async update(uuid: string, dto: UpdateCurriculumDto, userId: string) {
    const curriculum = await this.prisma.curriculum.findFirst({
      where: {
        uuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
    });

    if (!curriculum) {
      throw new NotFoundException(`Curriculum with UUID ${uuid} not found`);
    }

    await this.prisma.curriculum.update({
      where: { uuid },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    return this.findOne(uuid, userId);
  }

  async remove(uuid: string, userId: string) {
    const curriculum = await this.prisma.curriculum.findFirst({
      where: {
        uuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
    });

    if (!curriculum) {
      throw new NotFoundException(`Curriculum with UUID ${uuid} not found`);
    }

    // Soft delete curriculum and its items
    await this.prisma.$transaction([
      this.prisma.curriculumItem.updateMany({
        where: { curriculumId: curriculum.id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.prisma.curriculum.update({
        where: { uuid },
        data: { deletedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  // Curriculum Items

  async createItem(dto: CreateCurriculumItemDto, userId: string) {
    const curriculum = await this.prisma.curriculum.findFirst({
      where: {
        uuid: dto.curriculumUuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
    });

    if (!curriculum) {
      throw new NotFoundException(`Curriculum with UUID ${dto.curriculumUuid} not found`);
    }

    // 미디어 파일 개수 제한 체크
    const totalMediaFiles =
      (dto.newMediaFiles?.length ?? 0) + (dto.existingMediaFileUuids?.length ?? 0);
    if (totalMediaFiles > MAX_MEDIA_FILES_PER_ITEM) {
      throw new BadRequestException(
        `아이템당 최대 ${MAX_MEDIA_FILES_PER_ITEM}개의 파일만 첨부할 수 있습니다.`,
      );
    }

    // 새 파일들의 용량 체크
    if (dto.newMediaFiles && dto.newMediaFiles.length > 0) {
      const totalSize = dto.newMediaFiles.reduce((sum, f) => sum + f.fileSize, 0);
      const canUpload = await this.storageQuotaService.canUpload(userId, totalSize);
      if (!canUpload) {
        throw new BadRequestException('스토리지 용량이 부족합니다.');
      }
    }

    // 기존 파일 재활용 시 소유권 확인
    let existingMediaFiles: { id: number }[] = [];
    if (dto.existingMediaFileUuids && dto.existingMediaFileUuids.length > 0) {
      existingMediaFiles = await this.prisma.mediaFile.findMany({
        where: {
          uuid: { in: dto.existingMediaFileUuids },
          userId,
        },
        select: { id: true },
      });

      if (existingMediaFiles.length !== dto.existingMediaFileUuids.length) {
        throw new BadRequestException('일부 파일을 찾을 수 없거나 권한이 없습니다.');
      }
    }

    // 새 파일들 temp → media 폴더로 이동
    const movedFiles: { url: string; publicId: string; dto: CreateMediaFileDto }[] = [];
    if (dto.newMediaFiles) {
      for (const fileDto of dto.newMediaFiles) {
        const result = await this.cloudinaryService.moveMediaFile(fileDto.url, fileDto.type);
        if (!result) {
          throw new BadRequestException('파일 이동에 실패했습니다.');
        }
        movedFiles.push({ url: result.url, publicId: result.publicId, dto: fileDto });
      }
    }

    // 트랜잭션으로 DB 작업 수행
    const item = await this.prisma.$transaction(async (tx) => {
      // CurriculumItem 생성
      const newItem = await tx.curriculumItem.create({
        data: {
          title: dto.title,
          description: dto.description,
          curriculumId: curriculum.id,
        },
      });

      // 새 MediaFile 레코드 생성 및 연결
      for (const moved of movedFiles) {
        const mediaFile = await tx.mediaFile.create({
          data: {
            url: moved.url,
            publicId: moved.publicId,
            type: moved.dto.type,
            fileName: moved.dto.fileName,
            fileSize: moved.dto.fileSize,
            userId,
          },
        });

        await tx.curriculumItemMediaFile.create({
          data: {
            curriculumItemId: newItem.id,
            mediaFileId: mediaFile.id,
          },
        });
      }

      // 기존 파일 연결
      for (const existingFile of existingMediaFiles) {
        await tx.curriculumItemMediaFile.create({
          data: {
            curriculumItemId: newItem.id,
            mediaFileId: existingFile.id,
          },
        });
      }

      // 용량 증가
      if (movedFiles.length > 0) {
        const totalSize = movedFiles.reduce((sum, f) => sum + f.dto.fileSize, 0);
        await this.storageQuotaService.increaseUsage(userId, totalSize);
      }

      return newItem;
    });

    return this.findItem(item.uuid, userId);
  }

  async findItem(uuid: string, userId: string) {
    const item = await this.prisma.curriculumItem.findFirst({
      where: {
        uuid,
        deletedAt: null,
        curriculum: {
          deletedAt: null,
          organization: { userId, deletedAt: null },
        },
      },
      include: {
        mediaFiles: {
          orderBy: { createdAt: 'asc' },
          include: { mediaFile: true },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`CurriculumItem with UUID ${uuid} not found`);
    }

    return { success: true, data: item };
  }

  async updateItem(uuid: string, dto: UpdateCurriculumItemDto, userId: string) {
    const item = await this.prisma.curriculumItem.findFirst({
      where: {
        uuid,
        deletedAt: null,
        curriculum: {
          deletedAt: null,
          organization: { userId, deletedAt: null },
        },
      },
      include: {
        mediaFiles: {
          include: { mediaFile: true },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`CurriculumItem with UUID ${uuid} not found`);
    }

    // 현재 파일 수 계산
    const currentFileCount = item.mediaFiles.length;
    const removeCount = dto.removeMediaFileUuids?.length ?? 0;
    const addNewCount = dto.addNewMediaFiles?.length ?? 0;
    const addExistingCount = dto.addExistingMediaFileUuids?.length ?? 0;
    const newTotalCount = currentFileCount - removeCount + addNewCount + addExistingCount;

    if (newTotalCount > MAX_MEDIA_FILES_PER_ITEM) {
      throw new BadRequestException(
        `아이템당 최대 ${MAX_MEDIA_FILES_PER_ITEM}개의 파일만 첨부할 수 있습니다.`,
      );
    }

    // 새 파일들의 용량 체크
    if (dto.addNewMediaFiles && dto.addNewMediaFiles.length > 0) {
      const totalSize = dto.addNewMediaFiles.reduce((sum, f) => sum + f.fileSize, 0);
      const canUpload = await this.storageQuotaService.canUpload(userId, totalSize);
      if (!canUpload) {
        throw new BadRequestException('스토리지 용량이 부족합니다.');
      }
    }

    // 기존 파일 재활용 시 소유권 확인
    let existingMediaFiles: { id: number }[] = [];
    if (dto.addExistingMediaFileUuids && dto.addExistingMediaFileUuids.length > 0) {
      existingMediaFiles = await this.prisma.mediaFile.findMany({
        where: {
          uuid: { in: dto.addExistingMediaFileUuids },
          userId,
        },
        select: { id: true },
      });

      if (existingMediaFiles.length !== dto.addExistingMediaFileUuids.length) {
        throw new BadRequestException('일부 파일을 찾을 수 없거나 권한이 없습니다.');
      }
    }

    // 삭제할 파일들 조회
    let filesToRemove: typeof item.mediaFiles = [];
    if (dto.removeMediaFileUuids && dto.removeMediaFileUuids.length > 0) {
      filesToRemove = item.mediaFiles.filter((mf) =>
        dto.removeMediaFileUuids!.includes(mf.mediaFile.uuid),
      );
    }

    // 새 파일들 temp → media 폴더로 이동
    const movedFiles: { url: string; publicId: string; dto: CreateMediaFileDto }[] = [];
    if (dto.addNewMediaFiles) {
      for (const fileDto of dto.addNewMediaFiles) {
        const result = await this.cloudinaryService.moveMediaFile(fileDto.url, fileDto.type);
        if (!result) {
          throw new BadRequestException('파일 이동에 실패했습니다.');
        }
        movedFiles.push({ url: result.url, publicId: result.publicId, dto: fileDto });
      }
    }

    // 트랜잭션으로 DB 작업 수행
    await this.prisma.$transaction(async (tx) => {
      // CurriculumItem 업데이트
      await tx.curriculumItem.update({
        where: { uuid },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
        },
      });

      // 파일 연결 해제 (hard delete)
      for (const mf of filesToRemove) {
        await tx.curriculumItemMediaFile.delete({
          where: { id: mf.id },
        });
      }

      // 새 MediaFile 레코드 생성 및 연결
      for (const moved of movedFiles) {
        const mediaFile = await tx.mediaFile.create({
          data: {
            url: moved.url,
            publicId: moved.publicId,
            type: moved.dto.type,
            fileName: moved.dto.fileName,
            fileSize: moved.dto.fileSize,
            userId,
          },
        });

        await tx.curriculumItemMediaFile.create({
          data: {
            curriculumItemId: item.id,
            mediaFileId: mediaFile.id,
          },
        });
      }

      // 기존 파일 연결
      for (const existingFile of existingMediaFiles) {
        const existingLink = await tx.curriculumItemMediaFile.findFirst({
          where: {
            curriculumItemId: item.id,
            mediaFileId: existingFile.id,
          },
        });

        if (!existingLink) {
          await tx.curriculumItemMediaFile.create({
            data: {
              curriculumItemId: item.id,
              mediaFileId: existingFile.id,
            },
          });
        }
      }

      // 용량 증가
      if (movedFiles.length > 0) {
        const totalSize = movedFiles.reduce((sum, f) => sum + f.dto.fileSize, 0);
        await this.storageQuotaService.increaseUsage(userId, totalSize);
      }
    });

    return this.findItem(uuid, userId);
  }

  async removeItem(uuid: string, userId: string) {
    const item = await this.prisma.curriculumItem.findFirst({
      where: {
        uuid,
        deletedAt: null,
        curriculum: {
          deletedAt: null,
          organization: { userId, deletedAt: null },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`CurriculumItem with UUID ${uuid} not found`);
    }

    await this.prisma.curriculumItem.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
