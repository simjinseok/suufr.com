import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCurriculumDto,
  UpdateCurriculumDto,
  CreateCurriculumItemDto,
  UpdateCurriculumItemDto,
  CreateCurriculumSectionDto,
  UpdateCurriculumSectionDto,
} from './dto';
import { CURRICULUM_INCLUDE, ITEM_INCLUDE, serializeCurriculum, serializeItem } from './curriculum-serializer';
import { nextSortOrder, renumber, swapWithNeighbor, type MoveDirection } from './curriculum-order';

const MAX_MEDIA_FILES_PER_ITEM = 5;

@Injectable()
export class CurriculumsService {
  constructor(
    private readonly prisma: PrismaService,
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
      include: CURRICULUM_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: curriculums.map(serializeCurriculum) };
  }

  async findOne(uuid: string, userId: string) {
    const curriculum = await this.prisma.curriculum.findFirst({
      where: {
        uuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
      include: CURRICULUM_INCLUDE,
    });

    if (!curriculum) {
      throw new NotFoundException(`Curriculum with UUID ${uuid} not found`);
    }

    return { success: true, data: serializeCurriculum(curriculum) };
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
      this.prisma.curriculumSection.updateMany({
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

  // Curriculum Sections

  /** 내 조직의 커리큘럼인지 확인하고 돌려준다 */
  private async findOwnedCurriculum(uuid: string, userId: string) {
    const curriculum = await this.prisma.curriculum.findFirst({
      where: { uuid, deletedAt: null, organization: { userId, deletedAt: null } },
      select: { id: true, uuid: true },
    });
    if (!curriculum) {
      throw new NotFoundException(`Curriculum with UUID ${uuid} not found`);
    }
    return curriculum;
  }

  private async findOwnedSection(uuid: string, userId: string) {
    const section = await this.prisma.curriculumSection.findFirst({
      where: {
        uuid,
        deletedAt: null,
        curriculum: { deletedAt: null, organization: { userId, deletedAt: null } },
      },
      include: { curriculum: { select: { id: true, uuid: true } } },
    });
    if (!section) {
      throw new NotFoundException(`CurriculumSection with UUID ${uuid} not found`);
    }
    return section;
  }

  /** 커리큘럼의 살아 있는 섹션 목록(순서 계산용) */
  private listSectionsForOrder(curriculumId: number) {
    return this.prisma.curriculumSection.findMany({
      where: { curriculumId, deletedAt: null },
      select: { id: true, sortOrder: true },
    });
  }

  /** 한 묶음(섹션 또는 섹션 없음)의 살아 있는 항목 목록(순서 계산용) */
  private listItemsForOrder(curriculumId: number, sectionId: number | null) {
    return this.prisma.curriculumItem.findMany({
      where: { curriculumId, sectionId, deletedAt: null },
      select: { id: true, sortOrder: true },
    });
  }

  /** sectionUuid → sectionId. 같은 커리큘럼의 살아 있는 섹션만 허용. 다른 커리큘럼이면 400, 삭제된 섹션이면 404. */
  private async resolveSectionId(curriculumId: number, sectionUuid: string): Promise<number> {
    const section = await this.prisma.curriculumSection.findFirst({
      where: { uuid: sectionUuid, curriculumId },
      select: { id: true, curriculumId: true, deletedAt: true },
    });
    if (!section) {
      throw new BadRequestException('이 커리큘럼의 섹션이 아닙니다.');
    }
    if (section.deletedAt) {
      throw new NotFoundException(`CurriculumSection with UUID ${sectionUuid} not found`);
    }
    return section.id;
  }

  async createSection(dto: CreateCurriculumSectionDto, userId: string) {
    const curriculum = await this.findOwnedCurriculum(dto.curriculumUuid, userId);
    const siblings = await this.listSectionsForOrder(curriculum.id);

    await this.prisma.curriculumSection.create({
      data: {
        title: dto.title,
        description: dto.description,
        curriculumId: curriculum.id,
        sortOrder: nextSortOrder(siblings),
      },
    });

    return this.findOne(curriculum.uuid, userId);
  }

  async updateSection(uuid: string, dto: UpdateCurriculumSectionDto, userId: string) {
    const section = await this.findOwnedSection(uuid, userId);

    await this.prisma.curriculumSection.update({
      where: { id: section.id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    return this.findOne(section.curriculum.uuid, userId);
  }

  async moveSection(uuid: string, direction: MoveDirection, userId: string) {
    const section = await this.findOwnedSection(uuid, userId);
    const siblings = await this.listSectionsForOrder(section.curriculumId);
    const updates = swapWithNeighbor(siblings, section.id, direction);

    if (updates && updates.length > 0) {
      await this.prisma.$transaction(
        updates.map(u => this.prisma.curriculumSection.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } })),
      );
    }

    return this.findOne(section.curriculum.uuid, userId);
  }

  /** 섹션만 지운다. 안의 항목은 섹션 없음 묶음 맨 뒤로 옮긴다(R7). */
  async removeSection(uuid: string, userId: string) {
    const section = await this.findOwnedSection(uuid, userId);
    const unsectioned = await this.listItemsForOrder(section.curriculumId, null);
    const orphans = await this.listItemsForOrder(section.curriculumId, section.id);

    await this.prisma.$transaction(async (tx) => {
      let next = nextSortOrder(unsectioned);
      const ordered = [...orphans].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
      for (const item of ordered) {
        await tx.curriculumItem.update({ where: { id: item.id }, data: { sectionId: null, sortOrder: next } });
        next += 1;
      }

      await tx.curriculumSection.update({ where: { id: section.id }, data: { deletedAt: new Date() } });

      const remaining = await tx.curriculumSection.findMany({
        where: { curriculumId: section.curriculumId, deletedAt: null, id: { not: section.id } },
        select: { id: true, sortOrder: true },
      });
      for (const u of renumber(remaining)) {
        await tx.curriculumSection.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } });
      }
    });

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

    const sectionId = dto.sectionUuid ? await this.resolveSectionId(curriculum.id, dto.sectionUuid) : null;
    const siblings = await this.listItemsForOrder(curriculum.id, sectionId);
    const sortOrder = nextSortOrder(siblings);

    // 미디어 파일 개수 제한 체크
    const totalMediaFiles = dto.mediaFileUuids?.length ?? 0;
    if (totalMediaFiles > MAX_MEDIA_FILES_PER_ITEM) {
      throw new BadRequestException(
        `아이템당 최대 ${MAX_MEDIA_FILES_PER_ITEM}개의 파일만 첨부할 수 있습니다.`,
      );
    }

    // 파일 소유권 확인
    let mediaFiles: { id: number }[] = [];
    if (dto.mediaFileUuids && dto.mediaFileUuids.length > 0) {
      mediaFiles = await this.prisma.mediaFile.findMany({
        where: {
          uuid: { in: dto.mediaFileUuids },
          userId,
        },
        select: { id: true },
      });

      if (mediaFiles.length !== dto.mediaFileUuids.length) {
        throw new BadRequestException('일부 파일을 찾을 수 없거나 권한이 없습니다.');
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
          sectionId,
          sortOrder,
        },
      });

      // 파일 연결
      for (const mediaFile of mediaFiles) {
        await tx.curriculumItemMediaFile.create({
          data: {
            curriculumItemId: newItem.id,
            mediaFileId: mediaFile.id,
          },
        });
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
      include: ITEM_INCLUDE,
    });

    if (!item) {
      throw new NotFoundException(`CurriculumItem with UUID ${uuid} not found`);
    }

    return { success: true, data: serializeItem(item) };
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

    // 섹션 이동: undefined = 유지, null = 섹션 없음으로, string = 그 섹션으로
    let placement: { sectionId: number | null; sortOrder: number } | null = null;
    let previousGroup: { sectionId: number | null } | null = null;
    if (dto.sectionUuid !== undefined) {
      const targetSectionId = dto.sectionUuid === null
        ? null
        : await this.resolveSectionId(item.curriculumId, dto.sectionUuid);
      if (targetSectionId !== item.sectionId) {
        const targetSiblings = await this.listItemsForOrder(item.curriculumId, targetSectionId);
        placement = { sectionId: targetSectionId, sortOrder: nextSortOrder(targetSiblings) };
        previousGroup = { sectionId: item.sectionId };
      }
    }

    // 현재 파일 수 계산
    const currentFileCount = item.mediaFiles.length;
    const removeCount = dto.removeMediaFileUuids?.length ?? 0;
    const addCount = dto.addMediaFileUuids?.length ?? 0;
    const newTotalCount = currentFileCount - removeCount + addCount;

    if (newTotalCount > MAX_MEDIA_FILES_PER_ITEM) {
      throw new BadRequestException(
        `아이템당 최대 ${MAX_MEDIA_FILES_PER_ITEM}개의 파일만 첨부할 수 있습니다.`,
      );
    }

    // 추가할 파일 소유권 확인
    let filesToAdd: { id: number }[] = [];
    if (dto.addMediaFileUuids && dto.addMediaFileUuids.length > 0) {
      filesToAdd = await this.prisma.mediaFile.findMany({
        where: {
          uuid: { in: dto.addMediaFileUuids },
          userId,
        },
        select: { id: true },
      });

      if (filesToAdd.length !== dto.addMediaFileUuids.length) {
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

    // 트랜잭션으로 DB 작업 수행
    await this.prisma.$transaction(async (tx) => {
      // CurriculumItem 업데이트
      await tx.curriculumItem.update({
        where: { uuid },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(placement && placement),
        },
      });

      // 파일 연결 해제 (hard delete)
      for (const mf of filesToRemove) {
        await tx.curriculumItemMediaFile.delete({
          where: { id: mf.id },
        });
      }

      // 파일 연결
      for (const fileToAdd of filesToAdd) {
        const existingLink = await tx.curriculumItemMediaFile.findFirst({
          where: {
            curriculumItemId: item.id,
            mediaFileId: fileToAdd.id,
          },
        });

        if (!existingLink) {
          await tx.curriculumItemMediaFile.create({
            data: {
              curriculumItemId: item.id,
              mediaFileId: fileToAdd.id,
            },
          });
        }
      }

      // 떠난 묶음 재번호
      if (previousGroup) {
        const remaining = await tx.curriculumItem.findMany({
          where: { curriculumId: item.curriculumId, sectionId: previousGroup.sectionId, deletedAt: null, id: { not: item.id } },
          select: { id: true, sortOrder: true },
        });
        for (const u of renumber(remaining)) {
          await tx.curriculumItem.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } });
        }
      }
    });

    return this.findItem(uuid, userId);
  }

  async moveItem(uuid: string, direction: MoveDirection, userId: string) {
    const item = await this.prisma.curriculumItem.findFirst({
      where: {
        uuid,
        deletedAt: null,
        curriculum: { deletedAt: null, organization: { userId, deletedAt: null } },
      },
      select: { id: true, curriculumId: true, sectionId: true, sortOrder: true },
    });
    if (!item) {
      throw new NotFoundException(`CurriculumItem with UUID ${uuid} not found`);
    }

    const siblings = await this.listItemsForOrder(item.curriculumId, item.sectionId);
    const updates = swapWithNeighbor(siblings, item.id, direction);
    if (updates && updates.length > 0) {
      await this.prisma.$transaction(
        updates.map(u => this.prisma.curriculumItem.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } })),
      );
    }

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

    await this.prisma.$transaction(async (tx) => {
      await tx.curriculumItem.update({ where: { uuid }, data: { deletedAt: new Date() } });
      const remaining = await tx.curriculumItem.findMany({
        where: { curriculumId: item.curriculumId, sectionId: item.sectionId, deletedAt: null, id: { not: item.id } },
        select: { id: true, sortOrder: true },
      });
      for (const u of renumber(remaining)) {
        await tx.curriculumItem.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } });
      }
    });

    return { success: true };
  }
}
