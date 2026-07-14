import { Controller, Get, Post, Delete, Patch, Body, Param, Query, NotFoundException, ForbiddenException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { StorageQuotaService } from './storage-quota.service';
import { FolderService } from './folder.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { randomUUID } from 'crypto';
import { CreateFileDto, CreateFolderDto, CreatePresignedUrlDto, UpdateFolderDto, MoveFileDto, UpdateFileDto } from './dto';
import { folderByContentType } from '../common/utils/content-type';
import {
  SUPPORTED_UPLOAD_TYPES,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_DOCUMENT_SIZE,
  MAX_SIZE_BY_TYPE,
  SUPPORTED_PROFILE_IMAGE_TYPES,
  MAX_PROFILE_IMAGE_SIZE,
} from '../common/constants/file-constraints';

@Controller('api/storage')
export class StorageController {
  constructor(
    private readonly storageQuotaService: StorageQuotaService,
    private readonly folderService: FolderService,
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

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
    @Body() body: CreatePresignedUrlDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { fileName, contentType, fileSize, purpose } = body;

    // 1-2. Validate contentType + file size (purpose=profile은 더 좁은 규칙)
    if (purpose === 'profile') {
      if (!SUPPORTED_PROFILE_IMAGE_TYPES.includes(contentType)) {
        throw new BadRequestException('지원하지 않는 파일 형식입니다.');
      }
      if (fileSize > MAX_PROFILE_IMAGE_SIZE) {
        throw new BadRequestException('파일 크기가 최대 크기(2MB)를 초과했습니다.');
      }
    }
    else {
      if (!SUPPORTED_UPLOAD_TYPES.includes(contentType)) {
        throw new BadRequestException('지원하지 않는 파일 형식입니다.');
      }

      const isImage = contentType.startsWith('image/');
      const isVideo = contentType.startsWith('video/');
      const maxSize = isImage ? MAX_IMAGE_SIZE : isVideo ? MAX_VIDEO_SIZE : MAX_DOCUMENT_SIZE;

      if (fileSize > maxSize) {
        const maxSizeMB = isImage ? '10MB' : isVideo ? '100MB' : '50MB';
        throw new BadRequestException(
          `파일 크기가 최대 크기(${maxSizeMB})를 초과했습니다.`,
        );
      }
    }

    // 3. Generate unique S3 key (바로 영구 경로에 저장)
    //    profile: 공개 prefix — iOS/공유 뷰가 서명 없이 읽는다. MediaFile 미등록,
    //    커밋(pending 태그 제거)은 PATCH students/organizations가 수행.
    const ext = fileName.split('.').pop();
    const uuid = randomUUID();
    const key = purpose === 'profile'
      ? `images/profiles/${user.userId}/${uuid}.${ext}`
      : `users/${user.userId}/${folderByContentType(contentType)}/${uuid}.${ext}`;

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
        // 클라이언트가 S3 PUT 시 그대로 에코해야 하는 서명 헤더 (누락 시 403)
        requiredHeaders: this.s3Service.getPresignedUploadRequiredHeaders(),
      },
    };
  }

  /**
    * 미디어 파일 생성 (S3 업로드 후 DB 저장)
    * presigned URL로 이미 영구 경로에 업로드된 파일을 DB에 등록
    */
  @Post('files')
  async createFile(
    @Body() body: CreateFileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { publicId, fileName, folderUuid } = body;

    // 1. 키가 반드시 본인 소유 경로(users/{userId}/)인지 검증 → 크로스테넌트 등록/삭제 차단
    const ownPrefix = `users/${user.userId}/`;
    if (!publicId.startsWith(ownPrefix)) {
      throw new ForbiddenException('잘못된 파일 경로입니다.');
    }

    // 2. S3에서 실제 객체를 확인 (존재 여부 + 진짜 크기/타입). 클라이언트 fileSize/type은 신뢰하지 않음
    const head = await this.s3Service.headObject(publicId);
    if (!head) {
      throw new BadRequestException('업로드된 파일을 찾을 수 없습니다.');
    }

    const fileSize = head.contentLength;
    const type = this.resourceTypeFromContentType(head.contentType);
    if (!type || fileSize <= 0) {
      // 알 수 없는 타입이거나 빈 파일이면 등록 거부 후 정리
      await this.s3Service.deleteFile(publicId);
      throw new BadRequestException('지원하지 않는 파일이거나 손상된 파일입니다.');
    }

    // 3. 실제 크기로 서버측 사이즈 제한 재검증 (presigned PUT은 실제 크기를 강제하지 않음)
    if (fileSize > MAX_SIZE_BY_TYPE[type]) {
      await this.s3Service.deleteFile(publicId);
      throw new BadRequestException('파일 크기가 허용 범위를 초과했습니다.');
    }

    // 4. pending 태그 제거 — 라이프사이클 회수 대상에서 제외.
    //    반드시 DB 등록 전에 수행: "등록됐는데 태그가 남아 라이프사이클에 삭제당하는" 케이스를 구조적으로 차단.
    //    (태그만 지우고 아래 트랜잭션이 실패하면 catch에서 S3 객체를 삭제하므로 고아가 남지 않는다)
    const tagsCleared = await this.s3Service.clearObjectTags(publicId);
    if (!tagsCleared) {
      throw new InternalServerErrorException('파일 등록에 실패했습니다. 다시 시도해주세요.');
    }

    // 5. URL은 신뢰 가능한 키로부터 서버가 재구성 (클라이언트 url 미신뢰)
    const cdnUrl = process.env.CDN_URL;
    const url = cdnUrl ? `${cdnUrl}/${publicId}` : publicId;

    // 5. folderUuid로 folderId 조회
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

    // 6. 용량 예약 + DB 레코드 생성을 한 트랜잭션으로 (원자성 — 실패/크래시 시 쿼터 드리프트 방지)
    try {
      const file = await this.prisma.$transaction(async (tx) => {
        const reserved = await this.storageQuotaService.reserveQuotaWithLock(user.userId, fileSize, tx);
        if (!reserved) {
          throw new ForbiddenException({
            message: '스토리지 용량이 부족합니다.',
            error: 'STORAGE_LIMIT_EXCEEDED',
          });
        }
        return tx.mediaFile.create({
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
      });

      // 목록 조회(listFiles) 응답과 형태를 맞춘다 — 방금 등록한 파일은 어디에도 연결 전
      return { success: true, data: { ...file, isInUse: false } };
    }
    catch (error) {
      // 예약/생성 실패 시 업로드된 S3 객체 정리 (쿼터는 트랜잭션 롤백으로 자동 복구)
      await this.s3Service.deleteFile(publicId);
      throw error;
    }
  }

  /**
   * S3 객체의 Content-Type을 MediaFile의 type으로 변환
   */
  private resourceTypeFromContentType(
    contentType?: string,
  ): 'image' | 'video' | 'document' | null {
    if (!contentType) return null;
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    if (contentType === 'application/pdf') return 'document';
    return null;
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
    }
    else if (folderId === 'root') {
      // 루트 레벨만
      where.folderId = null;
    }
    else if (folderId) {
      // 특정 폴더
      const folder = await this.prisma.folder.findFirst({
        where: { uuid: folderId, userId: user.userId },
      });
      if (folder) {
        where.folderId = folder.id;
      }
      else {
        // 폴더를 찾을 수 없으면 빈 결과
        return { success: true, data: [] };
      }
    }
    // folderId가 없고 search도 없으면 전체 조회

    const files = await this.prisma.mediaFile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { sessionMediaFiles: true, curriculumItemMediaFiles: true } },
        folder: {
          select: { id: true, uuid: true, name: true },
        },
      },
    });

    const filesWithInUse = files.map((file) => ({
      ...file,
      isInUse: file._count.sessionMediaFiles + file._count.curriculumItemMediaFiles > 0,
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
        curriculumItemMediaFiles: { take: 1 },
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
    if (file.sessionMediaFiles.length > 0 || file.curriculumItemMediaFiles.length > 0) {
      throw new ForbiddenException('다른 곳에서 사용 중인 파일은 삭제할 수 없습니다.');
    }

    // S3에서 파일 삭제 (성공 확인 후 DB 삭제)
    const s3Deleted = await this.s3Service.deleteByUrl(file.url);
    if (!s3Deleted) {
      throw new InternalServerErrorException('파일 삭제에 실패했습니다.');
    }

    // CloudFront 캐시 무효화 (실패해도 S3/DB 삭제는 진행, 캐시는 TTL 후 자동 만료됨)
    await this.s3Service.invalidateCloudFrontCache(file.publicId);

    // S3 삭제 성공 후에만 DB 삭제 + 용량 차감을 원자적으로 (폴더 삭제와 동일 패턴)
    await this.prisma.$transaction(async (tx) => {
      await tx.mediaFile.delete({
        where: { id: file.id },
      });
      await this.storageQuotaService.decreaseUsage(user.userId, file.fileSize, tx);
    });

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
