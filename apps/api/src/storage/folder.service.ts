import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageQuotaService } from './storage-quota.service';
import { S3Service } from '../s3/s3.service';

// 폴더명 유효성 검사 정규식: 한글, 영문, 숫자, 공백, -, _, (), []
const FOLDER_NAME_REGEX = /^[가-힣a-zA-Z0-9\s\-_\(\)\[\]]+$/;
const FOLDER_NAME_MAX_LENGTH = 50;

export type FolderWithChildren = {
  id: number;
  uuid: string;
  name: string;
  parentId: number | null;
  createdAt: Date;
  children: FolderWithChildren[];
  _count: { mediaFiles: number };
};

@Injectable()
export class FolderService {
  private readonly logger = new Logger(FolderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageQuotaService: StorageQuotaService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * 폴더명 유효성 검사
   */
  private validateFolderName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('폴더명을 입력해주세요.');
    }

    const trimmedName = name.trim();

    if (trimmedName.length > FOLDER_NAME_MAX_LENGTH) {
      throw new BadRequestException(`폴더명은 ${FOLDER_NAME_MAX_LENGTH}자를 초과할 수 없습니다.`);
    }

    if (!FOLDER_NAME_REGEX.test(trimmedName)) {
      throw new BadRequestException('폴더명에 특수문자를 사용할 수 없습니다. (한글, 영문, 숫자, 공백, -, _ 만 사용 가능)');
    }
  }

  /**
   * 폴더 생성
   */
  async create(userId: string, data: { name: string; parentUuid?: string }) {
    this.validateFolderName(data.name);

    let parentId: number | null = null;

    // 부모 폴더가 지정된 경우 검증
    if (data.parentUuid) {
      const parentFolder = await this.prisma.folder.findFirst({
        where: {
          uuid: data.parentUuid,
          userId,
        },
      });

      if (!parentFolder) {
        throw new NotFoundException('상위 폴더를 찾을 수 없습니다.');
      }

      parentId = parentFolder.id;
    }

    // 같은 위치에 동일한 이름의 폴더가 있는지 확인
    const existingFolder = await this.prisma.folder.findFirst({
      where: {
        userId,
        name: data.name.trim(),
        parentId,
      },
    });

    if (existingFolder) {
      throw new BadRequestException('같은 위치에 동일한 이름의 폴더가 이미 존재합니다.');
    }

    return this.prisma.folder.create({
      data: {
        userId,
        name: data.name.trim(),
        parentId,
      },
      select: {
        id: true,
        uuid: true,
        name: true,
        parentId: true,
        createdAt: true,
      },
    });
  }

  /**
   * 폴더 목록 조회 (트리 구조)
   */
  async findAll(userId: string): Promise<FolderWithChildren[]> {
    const folders = await this.prisma.folder.findMany({
      where: { userId },
      select: {
        id: true,
        uuid: true,
        name: true,
        parentId: true,
        createdAt: true,
        _count: {
          select: { mediaFiles: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // 트리 구조로 변환
    return this.buildTree(folders);
  }

  /**
   * 플랫 목록을 트리 구조로 변환
   */
  private buildTree(
    folders: Array<{
      id: number;
      uuid: string;
      name: string;
      parentId: number | null;
      createdAt: Date;
      _count: { mediaFiles: number };
    }>,
  ): FolderWithChildren[] {
    const folderMap = new Map<number, FolderWithChildren>();
    const roots: FolderWithChildren[] = [];

    // 먼저 모든 폴더를 맵에 추가
    for (const folder of folders) {
      folderMap.set(folder.id, {
        ...folder,
        children: [],
      });
    }

    // 부모-자식 관계 설정
    for (const folder of folders) {
      const node = folderMap.get(folder.id)!;
      if (folder.parentId === null) {
        roots.push(node);
      }
      else {
        const parent = folderMap.get(folder.parentId);
        if (parent) {
          parent.children.push(node);
        }
      }
    }

    return roots;
  }

  /**
   * 단일 폴더 조회
   */
  async findOne(userId: string, uuid: string) {
    const folder = await this.prisma.folder.findFirst({
      where: {
        uuid,
        userId,
      },
      select: {
        id: true,
        uuid: true,
        name: true,
        parentId: true,
        createdAt: true,
        parent: {
          select: {
            id: true,
            uuid: true,
            name: true,
          },
        },
        _count: {
          select: { mediaFiles: true },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException('폴더를 찾을 수 없습니다.');
    }

    return folder;
  }

  /**
   * 폴더 이름 수정
   */
  async update(userId: string, uuid: string, data: { name: string }) {
    this.validateFolderName(data.name);

    const folder = await this.prisma.folder.findFirst({
      where: {
        uuid,
        userId,
      },
    });

    if (!folder) {
      throw new NotFoundException('폴더를 찾을 수 없습니다.');
    }

    // 같은 위치에 동일한 이름의 폴더가 있는지 확인
    const existingFolder = await this.prisma.folder.findFirst({
      where: {
        userId,
        name: data.name.trim(),
        parentId: folder.parentId,
        id: { not: folder.id },
      },
    });

    if (existingFolder) {
      throw new BadRequestException('같은 위치에 동일한 이름의 폴더가 이미 존재합니다.');
    }

    return this.prisma.folder.update({
      where: { id: folder.id },
      data: { name: data.name.trim() },
      select: {
        id: true,
        uuid: true,
        name: true,
        parentId: true,
        createdAt: true,
      },
    });
  }

  /**
   * 폴더 삭제 (재귀적으로 하위 폴더와 파일 삭제)
   */
  async delete(userId: string, uuid: string) {
    const folder = await this.prisma.folder.findFirst({
      where: {
        uuid,
        userId,
      },
    });

    if (!folder) {
      throw new NotFoundException('폴더를 찾을 수 없습니다.');
    }

    // 재귀적으로 모든 하위 폴더 ID 수집
    const allFolderIds = await this.collectAllDescendantFolderIds(folder.id);
    allFolderIds.push(folder.id);

    // 모든 폴더에 속한 파일들 조회
    const files = await this.prisma.mediaFile.findMany({
      where: {
        folderId: { in: allFolderIds },
      },
      select: {
        id: true,
        url: true,
        publicId: true,
        fileSize: true,
      },
    });

    // 세션/커리큘럼에서 사용 중인 파일이 하나라도 있으면 폴더 삭제 차단 (파일 단건 삭제 가드와 일관)
    if (files.length > 0) {
      const fileIds = files.map(f => f.id);
      const [sessionRefs, curriculumRefs] = await Promise.all([
        this.prisma.sessionMediaFile.count({ where: { mediaFileId: { in: fileIds } } }),
        this.prisma.curriculumItemMediaFile.count({ where: { mediaFileId: { in: fileIds } } }),
      ]);
      if (sessionRefs + curriculumRefs > 0) {
        throw new BadRequestException('사용 중인 파일이 포함된 폴더는 삭제할 수 없습니다.');
      }
    }

    const totalBytes = files.reduce((sum, f) => sum + f.fileSize, 0);

    // 1. DB를 원자적으로 정리: 파일 레코드 + 폴더 + 쿼터 차감 (부분 실패로 인한 불일치 방지)
    await this.prisma.$transaction(async (tx) => {
      if (files.length > 0) {
        await tx.mediaFile.deleteMany({
          where: {
            id: { in: files.map(f => f.id) },
          },
        });
      }

      // 하위부터 삭제해야 FK 제약 조건 위반 방지 (역순, 원본 배열은 보존)
      for (const folderId of [...allFolderIds].reverse()) {
        await tx.folder.delete({
          where: { id: folderId },
        });
      }

      // 삭제한 전체 바이트만큼 차감 (S3 성공 여부와 무관하게 DB와 정합)
      if (totalBytes > 0) {
        await this.storageQuotaService.decreaseUsage(userId, totalBytes, tx);
      }
    });

    // 2. S3 삭제는 트랜잭션 밖에서 best-effort. 실패한 객체는 고아로 남으며 로그로 남긴다.
    for (const file of files) {
      const deleted = await this.s3Service.deleteByUrl(file.url);
      if (deleted) {
        await this.s3Service.invalidateCloudFrontCache(file.publicId);
      }
      else {
        this.logger.error(`S3 삭제 실패로 고아 객체 발생: ${file.publicId}`);
      }
    }

    return {
      deletedFolders: allFolderIds.length,
      deletedFiles: files.length,
      freedBytes: totalBytes,
    };
  }

  /**
   * 하위 폴더 ID 재귀적으로 수집
   */
  private async collectAllDescendantFolderIds(folderId: number): Promise<number[]> {
    const children = await this.prisma.folder.findMany({
      where: { parentId: folderId },
      select: { id: true },
    });

    const childIds = children.map(c => c.id);
    const descendantIds: number[] = [...childIds];

    for (const childId of childIds) {
      const grandchildIds = await this.collectAllDescendantFolderIds(childId);
      descendantIds.push(...grandchildIds);
    }

    return descendantIds;
  }

  /**
   * 파일을 다른 폴더로 이동
   */
  async moveFile(userId: string, fileUuid: string, folderUuid: string | null) {
    // 파일 확인
    const file = await this.prisma.mediaFile.findFirst({
      where: {
        uuid: fileUuid,
        userId,
      },
    });

    if (!file) {
      throw new NotFoundException('파일을 찾을 수 없습니다.');
    }

    let folderId: number | null = null;

    // 대상 폴더 확인
    if (folderUuid) {
      const folder = await this.prisma.folder.findFirst({
        where: {
          uuid: folderUuid,
          userId,
        },
      });

      if (!folder) {
        throw new NotFoundException('대상 폴더를 찾을 수 없습니다.');
      }

      folderId = folder.id;
    }

    // 파일 이동
    return this.prisma.mediaFile.update({
      where: { id: file.id },
      data: { folderId },
      select: {
        id: true,
        uuid: true,
        fileName: true,
        folderId: true,
        folder: {
          select: {
            id: true,
            uuid: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * 폴더의 전체 경로 조회 (breadcrumb용)
   */
  async getBreadcrumb(userId: string, uuid: string) {
    const folder = await this.prisma.folder.findFirst({
      where: {
        uuid,
        userId,
      },
    });

    if (!folder) {
      throw new NotFoundException('폴더를 찾을 수 없습니다.');
    }

    const breadcrumb: Array<{ id: number; uuid: string; name: string }> = [];
    let currentFolder: { id: number; uuid: string; name: string; parentId: number | null } | null = folder;

    while (currentFolder) {
      breadcrumb.unshift({
        id: currentFolder.id,
        uuid: currentFolder.uuid,
        name: currentFolder.name,
      });

      if (currentFolder.parentId) {
        currentFolder = await this.prisma.folder.findFirst({
          where: {
            id: currentFolder.parentId,
            userId,
          },
          select: {
            id: true,
            uuid: true,
            name: true,
            parentId: true,
          },
        });
      }
      else {
        currentFolder = null;
      }
    }

    return breadcrumb;
  }
}
