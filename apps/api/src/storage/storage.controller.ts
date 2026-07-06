import { Controller, Get, Post, Delete, Patch, Body, Param, Query, NotFoundException, ForbiddenException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { StorageQuotaService } from './storage-quota.service';
import { FolderService } from './folder.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { randomUUID } from 'crypto';
import { CreateFolderDto, UpdateFolderDto, MoveFileDto, UpdateFileDto } from './dto';

@Controller('api/storage')
export class StorageController {
  constructor(
    private readonly storageQuotaService: StorageQuotaService,
    private readonly folderService: FolderService,
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * contentType에 따라 폴더 이름 반환
   */
  private getFolderByContentType(contentType: string): string {
    if (contentType.startsWith('image/')) return 'images';
    if (contentType.startsWith('video/')) return 'videos';
    if (contentType === 'application/pdf') return 'documents';
    return 'files';
  }

  /**
   * 현재 사용자의 스토리지 용량 조회
   */
  @Get('quota')
  async getQuota(@CurrentUser() user: AuthenticatedUser) {
    const quota = await this.storageQuotaService.getQuota(user.userId);
    return { success: true, data: quota };
  }

  /**
   * Presigned URL 생성 (클라이언트 직접 업로드용)
   */
  @Post('presigned-url')
  async getPresignedUrl(
    @Body() body: { fileName: string; contentType: string; fileSize: number },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { fileName, contentType, fileSize } = body;

    // 1. Validate contentType
    const SUPPORTED_TYPES = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'application/pdf',
    ];

    if (!SUPPORTED_TYPES.includes(contentType)) {
      throw new BadRequestException('지원하지 않는 파일 형식입니다.');
    }

    // 2. Validate file size
    const isImage = contentType.startsWith('image/');
    const isVideo = contentType.startsWith('video/');
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
    const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB (PDF)
    const maxSize = isImage ? MAX_IMAGE_SIZE : isVideo ? MAX_VIDEO_SIZE : MAX_DOCUMENT_SIZE;

    if (fileSize > maxSize) {
      const maxSizeMB = isImage ? '10MB' : isVideo ? '100MB' : '50MB';
      throw new BadRequestException(
        `파일 크기가 최대 크기(${maxSizeMB})를 초과했습니다.`,
      );
    }

    // 3. Generate unique S3 key (바로 영구 경로에 저장)
    const ext = fileName.split('.').pop();
    const uuid = randomUUID();
    const folder = this.getFolderByContentType(contentType);
    const key = `users/${user.userId}/${folder}/${uuid}.${ext}`;

    // 4. Generate presigned URL
    const presignedUrl = await this.s3Service.getPresignedUploadUrl(
      key,
      contentType,
      300, // 5 minutes
    );

    // 5. Return response
    const expiresAt = Date.now() + 300 * 1000;
    const cdnUrl = process.env.CDN_URL;

    return {
      success: true,
      data: {
        presignedUrl,
        key,
        cdnUrl: cdnUrl ? `${cdnUrl}/${key}` : null,
        expiresAt,
      },
    };
  }

  /**
    * 미디어 파일 생성 (S3 업로드 후 DB 저장)
    * presigned URL로 이미 영구 경로에 업로드된 파일을 DB에 등록
    */
  @Post('files')
  async createFile(
    @Body() body: {
      url: string;
      publicId: string;
      type: 'image' | 'video' | 'document';
      fileName: string;
      fileSize: number;
      folderUuid?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { url, publicId, type, fileName, fileSize, folderUuid } = body;

    // 유효성 검사
    if (!url || !publicId || !type || !fileSize) {
      throw new BadRequestException('필수 필드가 누락되었습니다.');
    }

    // 비관적 락으로 용량 예약 (동시성 제어)
    const reserved = await this.storageQuotaService.reserveQuotaWithLock(user.userId, fileSize);
    if (!reserved) {
      // S3에서 파일 삭제 (이미 업로드된 경우)
      await this.s3Service.deleteByUrl(url);
      throw new ForbiddenException({
        message: '스토리지 용량이 부족합니다.',
        error: 'STORAGE_LIMIT_EXCEEDED',
      });
    }

    // folderUuid로 folderId 조회
    let folderId: number | null = null;
    if (folderUuid) {
      const folder = await this.prisma.folder.findFirst({
        where: {
          uuid: folderUuid,
          userId: user.userId,
        },
      });
      if (folder) {
        folderId = folder.id;
      }
    }

    // DB에 파일 레코드 생성 (이미 영구 경로에 업로드됨)
    try {
      const file = await this.prisma.mediaFile.create({
        data: {
          userId: user.userId,
          url,
          publicId,
          type,
          fileName,
          fileSize,
          folderId,
        },
      });

      return { success: true, data: file };
    } catch (dbError) {
      // DB 생성 실패 시 예약한 용량 롤백 및 S3 파일 삭제
      await this.storageQuotaService.releaseReservedQuota(user.userId, fileSize);
      await this.s3Service.deleteByUrl(url);
      throw dbError;
    }
  }

  /**
   * 현재 사용자의 미디어 파일 목록 조회
   * @param folderId - 'root' (루트만), uuid (특정 폴더), 없으면 전체
   * @param search - 파일명 검색 (전체 검색, folderId 무시)
   */
  @Get('files')
  async listFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Query('folderId') folderId?: string,
    @Query('search') search?: string,
  ) {
    // 검색이 있으면 전체에서 검색 (폴더 무시)
    const where: {
      userId: string;
      folderId?: number | null;
      fileName?: { contains: string; mode: 'insensitive' };
    } = { userId: user.userId };

    if (search && search.trim()) {
      // 전체 검색
      where.fileName = { contains: search.trim(), mode: 'insensitive' };
    } else if (folderId === 'root') {
      // 루트 레벨만
      where.folderId = null;
    } else if (folderId) {
      // 특정 폴더
      const folder = await this.prisma.folder.findFirst({
        where: { uuid: folderId, userId: user.userId },
      });
      if (folder) {
        where.folderId = folder.id;
      } else {
        // 폴더를 찾을 수 없으면 빈 결과
        return { success: true, data: [] };
      }
    }
    // folderId가 없고 search도 없으면 전체 조회

    const files = await this.prisma.mediaFile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { sessionMediaFiles: true } },
        folder: {
          select: { id: true, uuid: true, name: true },
        },
      },
    });

    const filesWithInUse = files.map((file) => ({
      ...file,
      isInUse: file._count.sessionMediaFiles > 0,
      _count: undefined,
    }));

    return { success: true, data: filesWithInUse };
  }

  /**
   * 미디어 파일 삭제
   * 파일이 어디에도 연결되지 않은 경우에만 삭제 가능
   */
  @Delete('files/:uuid')
  async deleteFile(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // 파일 조회
    const file = await this.prisma.mediaFile.findUnique({
      where: { uuid },
      include: {
        sessionMediaFiles: { take: 1 },
      },
    });

    if (!file) {
      throw new NotFoundException('파일을 찾을 수 없습니다.');
    }

    // 소유권 확인
    if (file.userId !== user.userId) {
      throw new ForbiddenException('파일을 삭제할 권한이 없습니다.');
    }

    // 연결된 곳이 있으면 삭제 불가
    if (file.sessionMediaFiles.length > 0) {
      throw new ForbiddenException('다른 곳에서 사용 중인 파일은 삭제할 수 없습니다.');
    }

    // S3에서 파일 삭제 (성공 확인 후 DB 삭제)
    const s3Deleted = await this.s3Service.deleteByUrl(file.url);
    if (!s3Deleted) {
      throw new InternalServerErrorException('파일 삭제에 실패했습니다.');
    }

    // CloudFront 캐시 무효화 (실패해도 S3/DB 삭제는 진행, 캐시는 TTL 후 자동 만료됨)
    await this.s3Service.invalidateCloudFrontCache(file.publicId);

    // S3 삭제 성공 후에만 DB에서 삭제 (hard delete)
    await this.prisma.mediaFile.delete({
      where: { id: file.id },
    });

    // 용량 감소
    await this.storageQuotaService.decreaseUsage(user.userId, file.fileSize);

    return { success: true };
  }

  /**
   * 파일을 다른 폴더로 이동
   */
  @Patch('files/:uuid/move')
  async moveFile(
    @Param('uuid') uuid: string,
    @Body() body: MoveFileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.folderService.moveFile(user.userId, uuid, body.folderUuid ?? null);
    return { success: true, data: result };
  }

  /**
   * 파일 이름 변경
   */
  @Patch('files/:uuid')
  async updateFile(
    @Param('uuid') uuid: string,
    @Body() body: UpdateFileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // 파일 조회
    const file = await this.prisma.mediaFile.findUnique({
      where: { uuid },
    });

    if (!file) {
      throw new NotFoundException('파일을 찾을 수 없습니다.');
    }

    // 소유권 확인
    if (file.userId !== user.userId) {
      throw new ForbiddenException('파일을 수정할 권한이 없습니다.');
    }

    // 파일명 업데이트
    const updatedFile = await this.prisma.mediaFile.update({
      where: { id: file.id },
      data: { fileName: body.fileName },
    });

    return { success: true, data: updatedFile };
  }

  // ==================== 폴더 API ====================

  /**
   * 폴더 생성
   */
  @Post('folders')
  async createFolder(
    @Body() body: CreateFolderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const folder = await this.folderService.create(user.userId, body);
    return { success: true, data: folder };
  }

  /**
   * 폴더 목록 조회 (트리 구조)
   */
  @Get('folders')
  async listFolders(@CurrentUser() user: AuthenticatedUser) {
    const folders = await this.folderService.findAll(user.userId);
    return { success: true, data: folders };
  }

  /**
   * 단일 폴더 조회
   */
  @Get('folders/:uuid')
  async getFolder(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const folder = await this.folderService.findOne(user.userId, uuid);
    return { success: true, data: folder };
  }

  /**
   * 폴더의 breadcrumb 조회
   */
  @Get('folders/:uuid/breadcrumb')
  async getFolderBreadcrumb(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const breadcrumb = await this.folderService.getBreadcrumb(user.userId, uuid);
    return { success: true, data: breadcrumb };
  }

  /**
   * 폴더 수정
   */
  @Patch('folders/:uuid')
  async updateFolder(
    @Param('uuid') uuid: string,
    @Body() body: UpdateFolderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const folder = await this.folderService.update(user.userId, uuid, body);
    return { success: true, data: folder };
  }

  /**
   * 폴더 삭제 (재귀적으로 하위 폴더/파일 삭제)
   */
  @Delete('folders/:uuid')
  async deleteFolder(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.folderService.delete(user.userId, uuid);
    return { success: true, data: result };
  }
}
