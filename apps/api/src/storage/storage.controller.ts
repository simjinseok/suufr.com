import { Controller, Get, Post, Delete, Body, Param, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { StorageQuotaService } from './storage-quota.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller('storage')
export class StorageController {
  constructor(
    private readonly storageQuotaService: StorageQuotaService,
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
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
   * 미디어 파일 생성 (Cloudinary 업로드 후 DB 저장)
   */
  @Post('files')
  async createFile(
    @Body() body: {
      url: string;
      publicId: string;
      type: 'image' | 'video';
      fileName: string;
      fileSize: number;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { url, publicId, type, fileName, fileSize } = body;

    // 유효성 검사
    if (!url || !publicId || !type || !fileSize) {
      throw new BadRequestException('필수 필드가 누락되었습니다.');
    }

    // 용량 확인
    const canUpload = await this.storageQuotaService.canUpload(user.userId, fileSize);
    if (!canUpload) {
      // Cloudinary에서 파일 삭제 (이미 업로드된 경우)
      await this.cloudinaryService.deleteByUrl(url, type);
      throw new ForbiddenException('스토리지 용량이 부족합니다.');
    }

    // DB에 파일 레코드 생성
    const file = await this.prisma.mediaFile.create({
      data: {
        userId: user.userId,
        url,
        publicId,
        type,
        fileName,
        fileSize,
      },
    });

    // 용량 증가
    await this.storageQuotaService.increaseUsage(user.userId, fileSize);

    return { success: true, data: file };
  }

  /**
   * 현재 사용자의 모든 미디어 파일 목록 조회
   */
  @Get('files')
  async listFiles(@CurrentUser() user: AuthenticatedUser) {
    const files = await this.prisma.mediaFile.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { sessionMediaFiles: true } },
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

    // Cloudinary에서 파일 삭제
    const resourceType = file.type as 'image' | 'video';
    await this.cloudinaryService.deleteByUrl(file.url, resourceType);

    // DB에서 삭제 (hard delete)
    await this.prisma.mediaFile.delete({
      where: { id: file.id },
    });

    // 용량 감소
    await this.storageQuotaService.decreaseUsage(user.userId, file.fileSize);

    return { success: true };
  }
}
